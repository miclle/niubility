package handler

import (
	"net/http"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/errors"
)

// LoginRequest represents the request body for password login.
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents the response for login.
type LoginResponse struct {
	User *entity.User `json:"user"`
}

// RegisterRequest represents the request body for user registration.
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ChangePasswordRequest represents the request body for changing password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password" binding:"required"`
}

// HasPasswordResponse represents the response for checking if user has a password.
type HasPasswordResponse struct {
	HasPassword bool `json:"has_password"`
}

// Login handles username+password authentication.
func (ctrl *Ctrl) Login(c *fox.Context, req *LoginRequest) (any, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user, err := ctrl.service.AuthenticateUser(ctx, req.Username, req.Password)
	if err != nil {
		return nil, httperrors.New(errors.ErrInvalidCredentials.Code, errors.ErrInvalidCredentials.Message)
	}

	if user.Status != entity.UserStatusActivated {
		return nil, httperrors.New(errors.ErrAccountInactive.Code, errors.ErrAccountInactive.Message)
	}

	tokenString, err := ctrl.issueToken(user.Username)
	if err != nil {
		c.Logger.Errorf("issue token failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	ctrl.setAuthCookie(c, tokenString)

	return &LoginResponse{User: user}, nil
}

// Register handles user self-registration.
// Only available when registration is enabled.
func (ctrl *Ctrl) Register(c *fox.Context, req *RegisterRequest) (any, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	if !ctrl.service.IsRegistrationEnabled(ctx) {
		return nil, httperrors.New(errors.ErrRegistrationClosed.Code, errors.ErrRegistrationClosed.Message)
	}

	user, err := ctrl.service.RegisterUser(ctx, req.Username, req.Email, req.Password)
	if err != nil {
		c.Logger.Errorf("register user failed: %v", err)
		return nil, httperrors.New(http.StatusBadRequest, err.Error())
	}

	return user, nil
}

// ChangePassword handles password change for the current user.
func (ctrl *Ctrl) ChangePassword(c *fox.Context, req *ChangePasswordRequest) (any, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	if len(req.NewPassword) < 6 {
		return nil, httperrors.New(errors.ErrPasswordTooShort.Code, errors.ErrPasswordTooShort.Message)
	}

	if err := ctrl.service.ChangePassword(ctx, user.ID, req.OldPassword, req.NewPassword); err != nil {
		return nil, httperrors.New(http.StatusBadRequest, err.Error())
	}

	return map[string]string{"message": "密码修改成功"}, nil
}

// HasPassword returns whether the current user has a password set.
func (ctrl *Ctrl) HasPassword(c *fox.Context) (*HasPasswordResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	has, err := ctrl.service.HasPassword(ctx, user.ID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &HasPasswordResponse{HasPassword: has}, nil
}

// issueToken creates a signed JWT token for the given username.
func (ctrl *Ctrl) issueToken(username string) (string, error) {
	timeNow := time.Now()
	expiresAt := timeNow.Add(30 * 24 * time.Hour)

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    username,
		IssuedAt:  jwt.NewNumericDate(timeNow),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
	})

	return jwtToken.SignedString([]byte(ctrl.service.GetJWTSecret()))
}

// setAuthCookie sets the authentication cookie on the response.
func (ctrl *Ctrl) setAuthCookie(c *fox.Context, tokenString string) {
	ctx := c.Logger.WithContext(c.Request.Context())
	secure := ctrl.service.IsCookieSecure(ctx)

	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    tokenString,
		Path:     "/",
		MaxAge:   30 * 24 * 60 * 60, // 30 days
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	if cookie.Secure {
		cookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, cookie)
}
