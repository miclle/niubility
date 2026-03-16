package handler

import (
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

// skipPaths are paths that bypass authentication entirely.
var skipPaths = []string{
	"/sso",
	"/logout",
	"/health",
	"/api/v1/init",
	"/api/v1/login",
	"/api/v1/register",

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
}

// AuthMiddleware validates the JWT cookie.
// Unauthenticated API requests receive 401; browser requests are let through for the frontend to handle.
func (ctrl *Ctrl) AuthMiddleware(c *fox.Context) (res any) {
	path := c.Request.URL.Path
	for _, prefix := range skipPaths {
		if strings.HasPrefix(path, prefix) {
			return nil
		}
	}

	// If system is not initialized, let frontend handle navigation
	if !ctrl.service.IsInitialized() {
		if strings.HasPrefix(path, "/api") && !isSoftPath(path) {
			return httperrors.ErrUnauthorized
		}
		return nil
	}

	var (
		token, _ = c.Cookie(CookieName)
		claims   jwt.RegisteredClaims
		err      error
	)

	if len(token) == 0 {
		goto unauthorized
	}

	_, err = jwt.ParseWithClaims(token, &claims, func(token *jwt.Token) (any, error) {
		return []byte(ctrl.service.GetJWTSecret()), nil
	})
	if err != nil {
		goto unauthorized
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

unauthorized:
	if strings.HasPrefix(path, "/api") && !isSoftPath(path) {
		return httperrors.ErrUnauthorized
	}

	// Let the frontend handle login redirect
	return nil
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
