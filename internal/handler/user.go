package handler

import (
	"fmt"
	"net/http"
	"net/url"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/sso"
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
// Only available when SSO is enabled.
func (ctrl *Ctrl) SSOCallback(c *fox.Context, args *SSOCallbackArgs) any {
	if !ctrl.service.IsSSOEnabled() {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	ssoSvc := ctrl.getSSOService()
	if ssoSvc == nil {
		c.Logger.Error("sso service not configured")
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := ssoSvc.GetLoginUserInfo(c, args.Token)
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

	tokenString, err := ctrl.issueToken(user.Username)
	if err != nil {
		c.Logger.Errorf("create jwt token failed: %s", err.Error())
		return render.Redirect{Code: 302, Location: "/500"}
	}

	ctrl.setAuthCookie(c, tokenString)

	if args.Redirect == "" {
		args.Redirect = "/"
	}

	return render.Redirect{Code: 302, Location: args.Redirect}
}

// BootResponse represents the boot response.
type BootResponse struct {
	Initialized         bool                `json:"initialized"`
	Authentication      AuthenticationState `json:"authentication"`
	User                *entity.User        `json:"user,omitempty"`
	Categories          []entity.Category   `json:"categories"`
	RegistrationEnabled bool                `json:"registration_enabled"`
	SSOEnabled          bool                `json:"sso_enabled"`
	SSOLoginURL         string              `json:"sso_login_url,omitempty"`
}

// Boot returns the current system and authentication state.
func (ctrl *Ctrl) Boot(c *fox.Context) *BootResponse {
	initialized := ctrl.service.IsInitialized()

	categories, _ := ctrl.service.ListCategories(true)
	if categories == nil {
		categories = []entity.Category{}
	}

	resp := &BootResponse{
		Initialized:         initialized,
		Authentication:      AuthenticationStateUnauthorized,
		Categories:          categories,
		RegistrationEnabled: ctrl.service.IsRegistrationEnabled(),
		SSOEnabled:          ctrl.service.IsSSOEnabled(),
	}

	// Build SSO login URL if SSO is enabled
	if resp.SSOEnabled {
		resp.SSOLoginURL = ctrl.buildSSOLoginURL(c)
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

// Logout clears the authentication cookie and redirects.
func (ctrl *Ctrl) Logout(c *fox.Context, args *LogoutArgs) render.Redirect {
	secure := ctrl.service.IsCookieSecure()

	cookie := &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}

	if cookie.Secure {
		cookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, cookie)

	if args.Redirect == "" {
		args.Redirect = "/login"
	}

	// If SSO is enabled, redirect to SSO signout
	if ctrl.service.IsSSOEnabled() {
		ssoHost, _ := ctrl.service.GetSetting(entity.SettingSSOHost)
		if ssoHost != "" {
			scheme := "https"
			if c.Request.TLS == nil {
				scheme = "http"
			}
			redirect := fmt.Sprintf("%s://%s/sso?redirect=%s", scheme, c.Request.Host, args.Redirect)
			location := fmt.Sprintf("%s/signout?redirect=%s", ssoHost, redirect)
			return render.Redirect{Code: 302, Location: location}
		}
	}

	return render.Redirect{Code: 302, Location: args.Redirect}
}

// getSSOService creates an SSO service from database settings.
func (ctrl *Ctrl) getSSOService() *sso.Service {
	host, _ := ctrl.service.GetSetting(entity.SettingSSOHost)
	clientID, _ := ctrl.service.GetSetting(entity.SettingSSOClientID)
	secret, _ := ctrl.service.GetSetting(entity.SettingSSOSecret)

	if host == "" || clientID == "" || secret == "" {
		return nil
	}

	return sso.NewService(sso.Config{
		Host:     host,
		ClientID: clientID,
		Secret:   secret,
	})
}

// buildSSOLoginURL constructs the SSO login redirect URL.
func (ctrl *Ctrl) buildSSOLoginURL(c *fox.Context) string {
	ssoSvc := ctrl.getSSOService()
	if ssoSvc == nil {
		return ""
	}

	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	callbackURL := fmt.Sprintf("%s://%s/sso", scheme, c.Request.Host)

	query := url.Values{}
	query.Set("client_id", ssoSvc.ClientID)
	query.Set("redirect", callbackURL)

	return fmt.Sprintf("%s?%s", ssoSvc.Host, query.Encode())
}

// SearchUsersArgs represents the query parameters for searching users.
type SearchUsersArgs struct {
	Q string `form:"q"`
}

// SearchUserItem represents a simplified user item for search results.
type SearchUserItem struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

// SearchUsersResponse represents the response for searching users.
type SearchUsersResponse struct {
	Users []SearchUserItem `json:"users"`
}

// SearchUsers returns a list of users matching the search query (authenticated users).
func (ctrl *Ctrl) SearchUsers(c *fox.Context, args *SearchUsersArgs) (*SearchUsersResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	if args.Q == "" {
		return &SearchUsersResponse{Users: []SearchUserItem{}}, nil
	}

	users, _, err := ctrl.service.ListUsers(entity.ListUsersArgs{
		Pagination: entity.Pagination{Limit: 20},
		Search:     args.Q,
	})
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	items := make([]SearchUserItem, len(users))
	for i, u := range users {
		items[i] = SearchUserItem{
			ID:     u.ID,
			Name:   u.Name,
			Avatar: u.Avatar,
		}
	}

	return &SearchUsersResponse{Users: items}, nil
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
	Departments []DepartmentWithCount `json:"departments"`
}

// DepartmentWithCount represents a department with user count.
type DepartmentWithCount struct {
	entity.Department
	UserCount int `json:"user_count"`
}

// ListDepartments returns all departments (admin only).
func (ctrl *Ctrl) ListDepartments(c *fox.Context) (*ListDepartmentsResponse, error) {
	departments, err := ctrl.service.ListDepartments()
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Get user counts per department
	userCounts, err := ctrl.service.GetDepartmentUserCounts()
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Build response with user counts
	result := make([]DepartmentWithCount, len(departments))
	for i, dept := range departments {
		result[i] = DepartmentWithCount{
			Department: dept,
			UserCount:  userCounts[dept.ID],
		}
	}

	return &ListDepartmentsResponse{Departments: result}, nil
}
