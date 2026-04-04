package handler

import (
	"net/http"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/render"

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

// BootResponse represents the boot response.
type BootResponse struct {
	Initialized         bool                `json:"initialized"`
	Authentication      AuthenticationState `json:"authentication"`
	User                *entity.User        `json:"user,omitempty"`
	Categories          []entity.Category   `json:"categories"`
	RegistrationEnabled bool                `json:"registration_enabled"`
	SSOEnabled          bool                `json:"sso_enabled"`
	SSOLoginURL         string              `json:"sso_login_url,omitempty"`
	Site                *entity.SiteConfig  `json:"site,omitempty"`
}

// Boot returns the current system and authentication state.
func (ctrl *Ctrl) Boot(c *fox.Context) *BootResponse {
	ctx := c.Logger.WithContext(c.Request.Context())

	initialized := ctrl.service.IsInitialized(ctx)

	categories, _ := ctrl.service.ListCategories(ctx, true)
	if categories == nil {
		categories = []entity.Category{}
	}

	resp := &BootResponse{
		Initialized:         initialized,
		Authentication:      AuthenticationStateUnauthorized,
		Categories:          categories,
		RegistrationEnabled: ctrl.service.IsRegistrationEnabled(ctx),
		SSOEnabled:          ctrl.service.GetSSOType(ctx) != "disabled",
	}

	// Build SSO login URL if SSO is enabled
	if resp.SSOEnabled {
		resp.SSOLoginURL = ctrl.buildSSOLoginURL(c, "/")
	}

	user := CurrentUser(c)
	if user != nil {
		resp.Authentication = AuthenticationStateAuthorized
		user.ResolveAssetURLs()
		resp.User = user
	}

	// Load site configuration
	if siteConfig, err := ctrl.service.GetSiteConfig(ctx); err == nil {
		resp.Site = siteConfig
	}

	return resp
}

// LogoutArgs represents the logout query parameters.
type LogoutArgs struct {
	Redirect string `query:"redirect"`
}

// Logout clears the authentication cookie and redirects.
func (ctrl *Ctrl) Logout(c *fox.Context, args *LogoutArgs) render.Redirect {
	ctx := c.Logger.WithContext(c.Request.Context())
	secure := ctrl.service.IsCookieSecure(ctx)

	if claims, err := ctrl.parseAuthClaimsFromRequest(c.Request); err == nil {
		if err := ctrl.service.RevokeUserSession(ctx, claims.SessionID); err != nil {
			c.Logger.Errorf("revoke user session failed: %v", err)
		}
	}

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
