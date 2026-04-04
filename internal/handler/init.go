package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
)

// InitRequest represents the request body for system initialization.
type InitRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required"`
}

// InitSystem handles the initial super admin setup.
// Only available when the system has not been initialized.
func (ctrl *Ctrl) InitSystem(c *fox.Context, req *InitRequest) (any, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.IsInitialized(ctx) {
		return nil, httperrors.ErrForbidden
	}

	user, err := ctrl.service.InitSuperAdmin(ctx, req.Username, req.Email, req.Password)
	if err != nil {
		c.Logger.Errorf("init super admin failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	// Auto-login: issue JWT token
	tokenString, err := ctrl.startUserSession(c, user)
	if err != nil {
		c.Logger.Errorf("issue token failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	ctrl.setAuthCookie(c, tokenString)

	return user, nil
}
