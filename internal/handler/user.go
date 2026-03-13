package handler

import (
	"net/http"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
)

// LoginArgs represents the login request body.
type LoginArgs struct {
	Username string `json:"username" binding:"required"`
}

// LoginResponse represents the login response.
type LoginResponse struct {
	User *entity.User `json:"user"`
}

// Login authenticates a user by username and sets a JWT cookie.
// This is a simplified login for development; will be replaced by WeCom OAuth later.
func (ctrl *Ctrl) Login(c *fox.Context, args LoginArgs) (*LoginResponse, error) {
	user, err := ctrl.service.GetUserByUsername(args.Username)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// auto-create user if not exists (simplified for development)
	if user == nil {
		user = &entity.User{
			Username: args.Username,
			Name:     args.Username,
			Role:     entity.RoleUser,
			Status:   entity.UserStatusActivated,
		}
		if err := ctrl.service.CreateUser(user); err != nil {
			return nil, httperrors.ErrInternalServerError
		}
	}

	if user.Status != entity.UserStatusActivated {
		return nil, httperrors.ErrForbidden
	}

	// generate JWT token
	claims := &Claims{
		UserID: user.ID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(ctrl.secret))
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	c.SetCookie(cookieName, tokenStr, 7*24*3600, "/", "", false, true)

	return &LoginResponse{User: user}, nil
}

// BootResponse represents the boot response containing current user info.
type BootResponse struct {
	User *entity.User `json:"user"`
}

// Boot returns the current authenticated user's information.
func (ctrl *Ctrl) Boot(c *fox.Context) (*BootResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}
	return &BootResponse{User: user}, nil
}

// ListUsersResponse represents the response for listing users.
type ListUsersResponse struct {
	Users      []entity.User    `json:"users"`
	Pagination entity.Pagination `json:"pagination"`
}

// ListUsers returns a paginated list of users (admin only).
func (ctrl *Ctrl) ListUsers(c *fox.Context, args entity.ListUsersArgs) (*ListUsersResponse, error) {
	users, total, err := ctrl.service.ListUsers(args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	args.Total = total

	return &ListUsersResponse{
		Users:      users,
		Pagination: args.Pagination,
	}, nil
}

// UpdateUser updates a user's role or status (admin only).
func (ctrl *Ctrl) UpdateUser(c *fox.Context, args entity.UpdateUserArgs) (*entity.User, error) {
	id := c.Param("id")

	user, err := ctrl.service.UpdateUser(id, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if user == nil {
		return nil, httperrors.ErrNotFound
	}

	return user, nil
}

// Logout clears the authentication cookie.
func (ctrl *Ctrl) Logout(c *fox.Context) {
	c.SetCookie(cookieName, "", -1, "/", "", false, true)
	c.Status(http.StatusNoContent)
}
