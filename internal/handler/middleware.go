package handler

import (
	"net/http"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
)

const (
	// currentUserKey is the context key for the authenticated user.
	currentUserKey = "current_user"
	// cookieName is the cookie name for the JWT token.
	cookieName = "token"
)

// Claims represents the JWT claims.
type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// AuthMiddleware extracts and validates the JWT token from cookie.
func (ctrl *Ctrl) AuthMiddleware(c *fox.Context) {
	tokenStr, err := c.Cookie(cookieName)
	if err != nil || tokenStr == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, httperrors.ErrUnauthorized)
		return
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		return []byte(ctrl.secret), nil
	})
	if err != nil || !token.Valid {
		c.AbortWithStatusJSON(http.StatusUnauthorized, httperrors.ErrUnauthorized)
		return
	}

	user, err := ctrl.service.GetUserByID(claims.UserID)
	if err != nil || user == nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, httperrors.ErrUnauthorized)
		return
	}

	if user.Status != entity.UserStatusActivated {
		c.AbortWithStatusJSON(http.StatusForbidden, httperrors.ErrForbidden)
		return
	}

	c.Set(currentUserKey, user)
	c.Next()
}

// RequireAdmin checks that the current user has admin role.
func (ctrl *Ctrl) RequireAdmin(c *fox.Context) {
	user := CurrentUser(c)
	if user == nil || !user.IsAdmin() {
		c.AbortWithStatusJSON(http.StatusForbidden, httperrors.ErrForbidden)
		return
	}
	c.Next()
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
