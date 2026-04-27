package handler

import (
	"context"
	"mime"
	"net"
	"net/http"
	"strings"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
)

const (
	// CookieName is the cookie name for the JWT token.
	CookieName = "NIUBILITY"
	// currentUserKey is the context key for the authenticated user.
	currentUserKey = "_current_user"
	// currentAuthClaimsKey is the context key for the authenticated JWT claims.
	currentAuthClaimsKey = "_current_auth_claims"
)

// skipPaths are paths that bypass authentication entirely.
var skipPaths = []string{
	"/sso/callback",
	"/sso/acs",
	"/sso/metadata",
	"/logout",
	"/health",
	"/api/v1/init",
	"/api/v1/login",
	"/api/v1/register",
	"/api/v1/sso/cli/start",
	"/api/v1/sso/cli/login",
	"/api/v1/sso/cli/exchange",

	// website routes
	"/forbidden",
	"/404",
	"/500",
	"/assets",
	"/favicon.ico",
	"/robots.txt",
	"/site.webmanifest",

	// website development environment
	"/@vite",
	"/@react-refresh",
	"/node_modules",
	"/src",
}

// softPaths are API paths that attempt authentication but allow unauthenticated access.
var softPaths = []string{
	"/api/v1/boot",
	"/api/v1/contents",
	"/api/v1/comments",
	"/api/v1/users/",
}

// AuthMiddleware validates the JWT cookie.
// Unauthenticated API requests receive 401; browser page requests may be redirected to SSO.
func (ctrl *Ctrl) AuthMiddleware(c *fox.Context) (res any) {
	path := c.Request.URL.Path
	for _, prefix := range skipPaths {
		if strings.HasPrefix(path, prefix) {
			return nil
		}
	}

	ctx := c.Logger.WithContext(c.Request.Context())

	if redirectURL, ok := ctrl.httpsRedirectURL(ctx, c.Request); ok {
		return render.Redirect{Code: http.StatusPermanentRedirect, Location: redirectURL}
	}

	// If system is not initialized, let frontend handle navigation
	if !ctrl.service.IsInitialized(ctx) {
		if strings.HasPrefix(path, "/api") && !isSoftPath(path) {
			return httperrors.ErrUnauthorized
		}
		return nil
	}

	var (
		claims *AuthClaims
		err    error
	)

	if requestAuthToken(c.Request) == "" {
		goto unauthorized
	}

	claims, err = ctrl.parseAuthClaimsFromRequest(c.Request)
	if err != nil {
		goto unauthorized
	}

	if claims != nil && len(claims.Issuer) > 0 {
		if claims.SessionID != "" && !ctrl.service.IsUserSessionActive(ctx, claims.SessionID) {
			goto unauthorized
		}

		user, err := ctrl.service.GetUserByUsername(ctx, claims.Issuer)
		if err == nil && user != nil {
			if user.Status == entity.UserStatusActivated {
				c.Set(currentUserKey, user)
				c.Set(currentAuthClaimsKey, claims)
				_ = ctrl.service.TouchUserSession(ctx, claims.SessionID, service.SessionAuditInfo{
					ClientType: claims.ClientType,
					ClientID:   claims.ClientID,
					ClientName: ctrl.requestClientInfo(c.Request).ClientName,
					UserAgent:  c.Request.UserAgent(),
					IPAddress:  requestIP(c.Request),
				})
				return nil
			}
			if strings.HasPrefix(path, "/api") {
				return httperrors.ErrForbidden
			}
			return render.Redirect{Code: 302, Location: "/forbidden"}
		}
	}

unauthorized:
	if strings.HasPrefix(path, "/api") && !isSoftPath(path) {
		return httperrors.ErrUnauthorized
	}

	if shouldRedirectPageRequestToSSO(c.Request, ctrl.service.GetSSOType(ctx) != "disabled") {
		if loginURL := ctrl.buildSSOLoginURL(c, currentRequestRedirectPath(c.Request)); loginURL != "" {
			return render.Redirect{Code: http.StatusFound, Location: loginURL}
		}
	}

	return nil
}

func shouldRedirectPageRequestToSSO(req *http.Request, ssoEnabled bool) bool {
	if req == nil {
		return false
	}

	if !ssoEnabled {
		return false
	}

	if req.Method != http.MethodGet && req.Method != http.MethodHead {
		return false
	}

	if req.URL == nil || req.URL.Path == "/login" {
		return false
	}

	if !requestAcceptsHTML(req) {
		return false
	}

	return true
}

func (ctrl *Ctrl) httpsRedirectURL(ctx context.Context, req *http.Request) (string, bool) {
	siteConfig, err := ctrl.service.GetSiteConfig(ctx)
	if err != nil || siteConfig == nil || !siteConfig.ForceHTTPS {
		return "", false
	}
	if requestIsHTTPS(req) {
		return "", false
	}

	host := req.Host
	if host == "" || isLocalhostHost(host) {
		return "", false
	}

	redirectURL := "https://" + host + req.URL.RequestURI()
	return redirectURL, true
}

func requestIsHTTPS(req *http.Request) bool {
	if req.TLS != nil {
		return true
	}
	if strings.EqualFold(req.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	if strings.EqualFold(req.Header.Get("X-Forwarded-Ssl"), "on") {
		return true
	}

	for _, part := range strings.Split(req.Header.Get("Forwarded"), ";") {
		if strings.EqualFold(strings.TrimSpace(part), "proto=https") {
			return true
		}
	}

	return false
}

func requestAcceptsHTML(req *http.Request) bool {
	accept := req.Header.Get("Accept")
	if accept == "" {
		return false
	}

	for _, part := range strings.Split(accept, ",") {
		mediaType, _, err := mime.ParseMediaType(strings.TrimSpace(part))
		if err != nil {
			continue
		}
		if mediaType == "text/html" || mediaType == "application/xhtml+xml" {
			return true
		}
	}

	return false
}

func currentRequestRedirectPath(req *http.Request) string {
	if req == nil || req.URL == nil {
		return "/"
	}

	redirect := req.URL.EscapedPath()
	if redirect == "" {
		redirect = "/"
	}
	if rawQuery := req.URL.RawQuery; rawQuery != "" {
		redirect += "?" + rawQuery
	}

	return redirect
}

func isLocalhostHost(host string) bool {
	hostname := host
	if strings.HasPrefix(hostname, "[") && strings.Contains(hostname, "]") {
		hostname = strings.TrimPrefix(strings.SplitN(hostname, "]", 2)[0], "[")
	} else if h, _, err := net.SplitHostPort(host); err == nil {
		hostname = h
	}

	hostname = strings.TrimSpace(hostname)
	return hostname == "localhost" || hostname == "127.0.0.1" || hostname == "::1"
}

// isSoftPath checks if the path allows unauthenticated access.
func isSoftPath(path string) bool {
	for _, p := range softPaths {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// RequireAdmin checks that the current user has admin role.
func (ctrl *Ctrl) RequireAdmin(c *fox.Context) (res any) {
	user := CurrentUser(c)
	if user == nil || !user.IsAdmin() {
		return httperrors.ErrForbidden
	}
	return nil
}

// CurrentUser retrieves the authenticated user from context.
func CurrentUser(c *fox.Context) *entity.User {
	v, exists := c.Get(currentUserKey)
	if !exists {
		return nil
	}
	user, ok := v.(*entity.User)
	if !ok {
		return nil
	}
	return user
}

// CurrentAuthClaims retrieves the authenticated claims from context.
func CurrentAuthClaims(c *fox.Context) *AuthClaims {
	v, exists := c.Get(currentAuthClaimsKey)
	if !exists {
		return nil
	}
	claims, ok := v.(*AuthClaims)
	if !ok {
		return nil
	}
	return claims
}
