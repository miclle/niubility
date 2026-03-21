package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/xml"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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

// SSOCallbackArgs represents the OIDC callback query parameters.
type SSOCallbackArgs struct {
	Code  string `query:"code"`
	State string `query:"state"`
}

// SSOCallback handles the OIDC authorization code callback.
func (ctrl *Ctrl) SSOCallback(c *fox.Context, args *SSOCallbackArgs) any {
	if ctrl.service.GetSSOType() != "oidc" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	// Validate state (CSRF protection)
	redirect, err := ctrl.validateSSOState(c, args.State)
	if err != nil {
		c.Logger.Errorf("invalid SSO state: %v", err)
		return render.Redirect{Code: 302, Location: "/login"}
	}

	provider, err := ctrl.getOIDCProvider(c)
	if err != nil {
		c.Logger.Errorf("get OIDC provider: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := provider.Exchange(c, sso.CallbackParams{Code: args.Code, State: args.State})
	if err != nil {
		c.Logger.Errorf("OIDC exchange failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	return ctrl.completeSSOLogin(c, userinfo, redirect)
}

// SSOAcsArgs represents the SAML ACS POST form parameters.
type SSOAcsArgs struct {
	SAMLResponse string `form:"SAMLResponse"`
	RelayState   string `form:"RelayState"`
}

// SSOAcs handles the SAML 2.0 Assertion Consumer Service callback.
func (ctrl *Ctrl) SSOAcs(c *fox.Context, args *SSOAcsArgs) any {
	if ctrl.service.GetSSOType() != "saml" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	provider, err := ctrl.getSAMLProvider(c)
	if err != nil {
		c.Logger.Errorf("get SAML provider: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := provider.Exchange(c, sso.CallbackParams{SAMLResponse: args.SAMLResponse, RelayState: args.RelayState})
	if err != nil {
		c.Logger.Errorf("SAML exchange failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	redirect := args.RelayState
	return ctrl.completeSSOLogin(c, userinfo, redirect)
}

// SSOMetadata returns the SAML SP metadata XML for IdP import.
func (ctrl *Ctrl) SSOMetadata(c *fox.Context) any {
	if ctrl.service.GetSSOType() != "saml" {
		return httperrors.ErrNotFound
	}

	provider, err := ctrl.getSAMLProvider(c)
	if err != nil {
		c.Logger.Errorf("get SAML provider: %v", err)
		return httperrors.ErrInternalServerError
	}

	metadata := provider.Metadata()
	c.Header("Content-Type", "application/samlmetadata+xml")
	xmlBytes, _ := xml.MarshalIndent(metadata, "", "  ")
	c.Writer.Write(xmlBytes) //nolint:errcheck
	return nil
}

// completeSSOLogin upserts the user, issues a JWT token, and redirects.
func (ctrl *Ctrl) completeSSOLogin(c *fox.Context, userinfo *sso.UserInfo, redirect string) render.Redirect {
	if userinfo.Username == "" {
		c.Logger.Error("SSO user username is empty")
		return render.Redirect{Code: 302, Location: "/500"}
	}

	user, err := ctrl.service.UpsertUser(userinfo.Username, userinfo.Email)
	if err != nil {
		c.Logger.Errorf("upsert user failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	tokenString, err := ctrl.issueToken(user.Username)
	if err != nil {
		c.Logger.Errorf("create jwt token failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	ctrl.setAuthCookie(c, tokenString)

	if redirect == "" {
		redirect = "/"
	}

	return render.Redirect{Code: 302, Location: redirect}
}

// getOIDCProvider creates an OIDC provider from database settings.
func (ctrl *Ctrl) getOIDCProvider(ctx context.Context) (*sso.OIDCProvider, error) {
	cfg, err := ctrl.service.GetOIDCConfig()
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("OIDC not configured")
	}
	return sso.NewOIDCProvider(ctx, cfg.Issuer, cfg.ClientID, cfg.ClientSecret)
}

// getSAMLProvider creates a SAML provider from database settings.
func (ctrl *Ctrl) getSAMLProvider(c *fox.Context) (*sso.SAMLProvider, error) {
	cfg, err := ctrl.service.GetSAMLConfig()
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("SAML not configured")
	}

	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	return sso.NewSAMLProvider(sso.SAMLConfig{
		IDPEntityID:    cfg.IDPEntityID,
		IDPSSOURL:      cfg.IDPSSOURL,
		IDPCertificate: cfg.IDPCertificate,
		SPEntityID:     baseURL + "/sso/metadata",
		SPACSURL:       baseURL + "/sso/acs",
	})
}

// buildSSOLoginURL constructs the SSO login URL based on sso_type.
func (ctrl *Ctrl) buildSSOLoginURL(c *fox.Context) string {
	ssoType := ctrl.service.GetSSOType()
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	switch ssoType {
	case "oidc":
		cfg, err := ctrl.service.GetOIDCConfig()
		if err != nil || cfg == nil {
			return ""
		}
		provider, err := sso.NewOIDCProvider(context.Background(), cfg.Issuer, cfg.ClientID, cfg.ClientSecret)
		if err != nil {
			return ""
		}
		state := ctrl.generateSSOState(c, "/")
		return provider.AuthURL(state, baseURL+"/sso/callback")

	case "saml":
		cfg, err := ctrl.service.GetSAMLConfig()
		if err != nil || cfg == nil {
			return ""
		}
		provider, err := sso.NewSAMLProvider(sso.SAMLConfig{
			IDPEntityID:    cfg.IDPEntityID,
			IDPSSOURL:      cfg.IDPSSOURL,
			IDPCertificate: cfg.IDPCertificate,
			SPEntityID:     baseURL + "/sso/metadata",
			SPACSURL:       baseURL + "/sso/acs",
		})
		if err != nil {
			return ""
		}
		return provider.AuthURL("/", "")

	default:
		return ""
	}
}

// generateSSOState creates an HMAC-signed state parameter for OIDC CSRF protection.
// Format: base64(redirect|expiry|hmac)
func (ctrl *Ctrl) generateSSOState(c *fox.Context, redirect string) string {
	expiry := strconv.FormatInt(time.Now().Add(10*time.Minute).Unix(), 10)
	payload := redirect + "|" + expiry
	mac := hmac.New(sha256.New, []byte(ctrl.service.GetJWTSecret()))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	state := base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + sig))

	// Store in cookie for validation
	secure := ctrl.service.IsCookieSecure()
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "sso_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		Secure:   secure,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	return state
}

// validateSSOState validates the HMAC-signed state parameter and returns the redirect URL.
func (ctrl *Ctrl) validateSSOState(c *fox.Context, state string) (string, error) {
	cookieState, err := c.Cookie("sso_state")
	if err != nil || cookieState != state {
		return "", fmt.Errorf("state mismatch")
	}

	decoded, err := base64.RawURLEncoding.DecodeString(state)
	if err != nil {
		return "", fmt.Errorf("decode state: %w", err)
	}

	parts := strings.SplitN(string(decoded), "|", 3)
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid state format")
	}

	redirect, expiryStr, sig := parts[0], parts[1], parts[2]

	// Verify expiry
	expiry, err := strconv.ParseInt(expiryStr, 10, 64)
	if err != nil || time.Now().Unix() > expiry {
		return "", fmt.Errorf("state expired")
	}

	// Verify HMAC
	payload := redirect + "|" + expiryStr
	mac := hmac.New(sha256.New, []byte(ctrl.service.GetJWTSecret()))
	mac.Write([]byte(payload))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return "", fmt.Errorf("invalid state signature")
	}

	// Clear the state cookie
	http.SetCookie(c.Writer, &http.Cookie{
		Name:   "sso_state",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	return redirect, nil
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
		SSOEnabled:          ctrl.service.GetSSOType() != "disabled",
	}

	// Build SSO login URL if SSO is enabled
	if resp.SSOEnabled {
		resp.SSOLoginURL = ctrl.buildSSOLoginURL(c)
	}

	user := CurrentUser(c)
	if user != nil {
		resp.Authentication = AuthenticationStateAuthorized
		user.ResolveAssetURLs()
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

	return render.Redirect{Code: 302, Location: args.Redirect}
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
			Avatar: entity.AvatarURL(u.Avatar),
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

	for i := range users {
		users[i].ResolveAssetURLs()
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

	user.ResolveAssetURLs()
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

	updatedUser.ResolveAssetURLs()
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

// GetProfile returns the current authenticated user's profile.
func (ctrl *Ctrl) GetProfile(c *fox.Context) (*entity.User, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}
	user.ResolveAssetURLs()
	return user, nil
}

// UpdateProfile updates the current authenticated user's own profile.
func (ctrl *Ctrl) UpdateProfile(c *fox.Context, args entity.UpdateProfileArgs) (*entity.User, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	updated, err := ctrl.service.UpdateProfile(user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if updated == nil {
		return nil, httperrors.ErrNotFound
	}

	updated.ResolveAssetURLs()
	return updated, nil
}

// UserProfileResponse represents the response for a user's profile page.
type UserProfileResponse struct {
	User                *entity.User `json:"user"`
	ContentCount        int64        `json:"content_count"`
	TotalLikes          int64        `json:"total_likes"`
	SpeakerContentCount int64        `json:"speaker_content_count"`
	Following           bool         `json:"following"`
}

// GetUserProfile returns a user's public profile with stats.
func (ctrl *Ctrl) GetUserProfile(c *fox.Context) (*UserProfileResponse, error) {
	currentUser := CurrentUser(c)
	if currentUser == nil {
		return nil, httperrors.ErrUnauthorized
	}

	username := c.Param("username")
	user, err := ctrl.service.GetUserByUsername(username)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if user == nil {
		return nil, httperrors.ErrNotFound
	}

	contentCount, _ := ctrl.service.GetUserContentCount(user.ID)
	totalLikes, _ := ctrl.service.GetUserTotalLikes(user.ID)
	speakerContentCount, _ := ctrl.service.GetUserSpeakerContentCount(user.ID)

	// Check if current user is following this user
	following := false
	if currentUser.ID != user.ID {
		following, _ = ctrl.service.IsFollowing(currentUser.ID, user.ID)
	}

	user.ResolveAssetURLs()

	return &UserProfileResponse{
		User:                user,
		ContentCount:        contentCount,
		TotalLikes:          totalLikes,
		SpeakerContentCount: speakerContentCount,
		Following:           following,
	}, nil
}
