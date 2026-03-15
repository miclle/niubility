package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
)

// AuthenticationState represents the authentication state.
type AuthenticationState string

const (
	// AuthenticationStateAuthorized indicates the user is authenticated.
	AuthenticationStateAuthorized AuthenticationState = "authorized"
	// AuthenticationStateUnauthorized indicates the user is not authenticated.
	AuthenticationStateUnauthorized AuthenticationState = "unauthorized"
)

// SSOCallbackArgs represents the SSO callback query parameters.
type SSOCallbackArgs struct {
	Token    string `query:"token"`
	Redirect string `query:"redirect"`
}

// SSOCallback handles the SSO login callback.
func (ctrl *Ctrl) SSOCallback(c *fox.Context, args *SSOCallbackArgs) any {
	userinfo, err := ctrl.sso.GetLoginUserInfo(c, args.Token)
	if err != nil {
		c.Logger.Errorf("sso get login user info failed, error: %+v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	if len(userinfo.Username) == 0 {
		c.Logger.Error("sso user username is empty")
		return render.Redirect{Code: 302, Location: "/500"}
	}

	user, err := ctrl.service.UpsertUser(userinfo.Username, userinfo.Email)
	if err != nil {
		c.Logger.Errorf("upsert user failed, err: %+v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	var (
		timeNow   = time.Now()
		expiresAt = timeNow.Add(30 * 24 * time.Hour)
	)

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    user.Username,
		IssuedAt:  jwt.NewNumericDate(timeNow),
		ExpiresAt: jwt.NewNumericDate(expiresAt),
	})

	tokenString, err := jwtToken.SignedString([]byte(ctrl.config.Server.Secret))
	if err != nil {
		c.Logger.Errorf("create jwt token failed: %s", err.Error())
		return render.Redirect{Code: 302, Location: "/500"}
	}

	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    tokenString,
		Path:     "/",
		MaxAge:   int(expiresAt.Sub(timeNow).Seconds()),
		Secure:   ctrl.config.Server.CookieSecure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	if cookie.Secure {
		cookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, cookie)

	if args.Redirect == "" {
		args.Redirect = "/"
	}

	return render.Redirect{Code: 302, Location: args.Redirect}
}

// BootResponse represents the boot response.
type BootResponse struct {
	Authentication AuthenticationState `json:"authentication"`
	User           *entity.User        `json:"user,omitempty"`
}

// Boot returns the current authenticated user's information.
func (ctrl *Ctrl) Boot(c *fox.Context) *BootResponse {
	resp := &BootResponse{
		Authentication: AuthenticationStateUnauthorized,
	}

	user := CurrentUser(c)
	if user != nil {
		resp.Authentication = AuthenticationStateAuthorized
		resp.User = user
	}

	return resp
}

// LogoutArgs represents the logout query parameters.
type LogoutArgs struct {
	Redirect string `query:"redirect"`
}

// Logout clears the authentication cookie and redirects to SSO signout.
func (ctrl *Ctrl) Logout(c *fox.Context, args *LogoutArgs) render.Redirect {
	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   ctrl.config.Server.CookieSecure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	if cookie.Secure {
		cookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, cookie)

	if args.Redirect == "" {
		args.Redirect = "/"
	}

	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}

	redirect := fmt.Sprintf("%s://%s/sso?redirect=%s", scheme, c.Request.Host, args.Redirect)
	location := fmt.Sprintf("%s/signout?redirect=%s", ctrl.config.SSO.Host, redirect)

	return render.Redirect{Code: 302, Location: location}
}

// ListUsersResponse represents the response for listing users.
type ListUsersResponse struct {
	Users      []entity.User     `json:"users"`
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

// SyncUserFromWechat syncs the current user's info from WeChat.
func (ctrl *Ctrl) SyncUserFromWechat(c *fox.Context) (*entity.User, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	updatedUser, err := ctrl.service.SyncUserFromWechat(user.Username)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if updatedUser == nil {
		return nil, httperrors.ErrNotFound
	}

	return updatedUser, nil
}

// SyncFromWechatResponse represents the response for syncing from WeChat.
type SyncFromWechatResponse struct {
	DepartmentsSynced int `json:"departments_synced"`
	UsersSynced       int `json:"users_synced"`
	UsersFailed       int `json:"users_failed"`
}

// SyncFromWechat syncs departments and all users from WeChat Work (admin only).
func (ctrl *Ctrl) SyncFromWechat(c *fox.Context) (*SyncFromWechatResponse, error) {
	// Sync departments first
	deptCount, err := ctrl.service.SyncDepartmentsFromWechat()
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Sync all users from WeChat
	userSynced, userFailed, err := ctrl.service.SyncAllWechatUsers()
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &SyncFromWechatResponse{
		DepartmentsSynced: deptCount,
		UsersSynced:       userSynced,
		UsersFailed:       userFailed,
	}, nil
}

// ListDepartmentsResponse represents the response for listing departments.
type ListDepartmentsResponse struct {
	Departments []entity.Department `json:"departments"`
}

// ListDepartments returns all departments (admin only).
func (ctrl *Ctrl) ListDepartments(c *fox.Context) (*ListDepartmentsResponse, error) {
	departments, err := ctrl.service.ListDepartments()
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return &ListDepartmentsResponse{Departments: departments}, nil
}
