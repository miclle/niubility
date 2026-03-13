package handler

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
)

const (
	// CookieName is the cookie name for the JWT token.
	CookieName = "NIUBILITY"
	// currentUserKey is the context key for the authenticated user.
	currentUserKey = "_current_user"
)

// skipPaths are paths that bypass authentication.
var skipPaths = []string{
	"/sso",
	"/logout",
	"/health",

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

// AuthMiddleware validates the JWT cookie and redirects unauthenticated browser requests to SSO.
func (ctrl *Ctrl) AuthMiddleware(c *fox.Context) (res any) {
	path := c.Request.URL.Path
	for _, prefix := range skipPaths {
		if strings.HasPrefix(path, prefix) {
			return nil
		}
	}

	var (
		token, _ = c.Cookie(CookieName)
		claims   jwt.RegisteredClaims
		err      error
	)

	if len(token) == 0 {
		goto redirect
	}

	_, err = jwt.ParseWithClaims(token, &claims, func(token *jwt.Token) (any, error) {
		return []byte(ctrl.config.Server.Secret), nil
	})
	if err != nil {
		goto redirect
	}

	if len(claims.Issuer) > 0 {
		user, err := ctrl.service.GetUserByUsername(claims.Issuer)
		if err == nil && user != nil {
			if user.Status == entity.UserStatusActivated {
				c.Set(currentUserKey, user)
				return nil
			}
			if strings.HasPrefix(path, "/api") {
				return httperrors.ErrForbidden
			}
			return render.Redirect{Code: 302, Location: "/forbidden"}
		}
	}

redirect:
	if strings.HasPrefix(path, "/api") {
		return httperrors.ErrUnauthorized
	}

	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := fmt.Sprintf("%s://%s/sso?redirect=%s", scheme, c.Request.Host, c.Request.RequestURI)

	query := url.Values{}
	query.Set("client_id", ctrl.sso.ClientID)
	query.Set("redirect", callbackURL)

	return render.Redirect{
		Code:     302,
		Location: fmt.Sprintf("%s?%s", ctrl.sso.Host, query.Encode()),
	}
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
