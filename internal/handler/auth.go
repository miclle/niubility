package handler

import (
	"net/http"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
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

// Login handles username+password authentication.
func (ctrl *Ctrl) Login(c *fox.Context, req *LoginRequest) (any, error) {
	user, err := ctrl.service.AuthenticateUser(req.Username, req.Password)
	if err != nil {
		return nil, httperrors.New(http.StatusUnauthorized, "用户名或密码错误")
	}

	if user.Status != entity.UserStatusActivated {
		return nil, httperrors.New(http.StatusForbidden, "账户未激活，请联系管理员")
	}

	tokenString, err := ctrl.issueToken(user.Username)
	if err != nil {
		c.Logger.Errorf("issue token failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	ctrl.setAuthCookie(c, tokenString)

	return &LoginResponse{User: user}, nil
}

// RegisterRequest represents the request body for user registration.
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Register handles user self-registration.
// Only available when registration is enabled.
func (ctrl *Ctrl) Register(c *fox.Context, req *RegisterRequest) (any, error) {
	if !ctrl.service.IsRegistrationEnabled() {
		return nil, httperrors.New(http.StatusForbidden, "用户注册未开放")
	}

	user, err := ctrl.service.RegisterUser(req.Username, req.Email, req.Password)
	if err != nil {
		c.Logger.Errorf("register user failed: %v", err)
		return nil, httperrors.New(http.StatusBadRequest, err.Error())
	}

	return user, nil
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
	secure := ctrl.service.IsCookieSecure()

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
