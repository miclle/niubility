package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/errors"
	"github.com/miclle/niubility/pkg/sso"
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

// RegisterRequest represents the request body for user registration.
type RegisterRequest struct {
	Username string `json:"username" binding:"required"`
	Email    string `json:"email"    binding:"required"`
	Password string `json:"password" binding:"required"`
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

// ChangePasswordRequest represents the request body for changing password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password" binding:"required"`
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

// HasPasswordResponse represents the response for checking if user has a password.
type HasPasswordResponse struct {
	HasPassword bool `json:"has_password"`
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
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "oidc" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	// Validate state (CSRF protection)
	redirect, err := ctrl.validateSSOState(c, args.State)
	if err != nil {
		c.Logger.Errorf("invalid SSO state: %v", err)
		return render.Redirect{Code: 302, Location: "/login"}
	}

	provider, err := ctrl.getOIDCProvider(ctx)
	if err != nil {
		c.Logger.Errorf("get OIDC provider: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := provider.Exchange(ctx, sso.CallbackParams{Code: args.Code, State: args.State})
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
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "saml" {
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
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "saml" {
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
	ctx := c.Logger.WithContext(c.Request.Context())

	if userinfo.Username == "" {
		c.Logger.Error("SSO user username is empty")
		return render.Redirect{Code: 302, Location: "/500"}
	}

	user, err := ctrl.service.UpsertUser(ctx, userinfo.Username, userinfo.Email)
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
	cfg, err := ctrl.service.GetOIDCConfig(ctx)
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("OIDC not configured")
	}
	return sso.NewOIDCProvider(ctx, cfg.Issuer, cfg.ClientID, cfg.ClientSecret)
}

// getSAMLProvider creates a SAML provider from database settings.
func (ctrl *Ctrl) getSAMLProvider(c *fox.Context) (*sso.SAMLProvider, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	cfg, err := ctrl.service.GetSAMLConfig(ctx)
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("SAML not configured")
	}

	// Fetch and parse IdP metadata
	metadata, err := sso.ParseIDPMetadata(ctx, cfg.IDPMetadataURL)
	if err != nil {
		return nil, fmt.Errorf("parse IdP metadata: %w", err)
	}

	// Determine scheme: prefer X-Forwarded-Proto header (reverse proxy), fallback to TLS
	scheme := "https"
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if c.Request.TLS == nil {
		scheme = "http"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	// Parse attribute mapping JSON
	var attrMapping map[string]string
	if cfg.AttributeMapping != "" {
		if err := json.Unmarshal([]byte(cfg.AttributeMapping), &attrMapping); err != nil {
			return nil, fmt.Errorf("parse attribute mapping: %w", err)
		}
	}

	return sso.NewSAMLProvider(sso.SAMLConfig{
		IDPEntityID:      metadata.EntityID,
		IDPSSOURL:        metadata.SSOURL,
		IDPCertificate:   metadata.Certificate,
		SPEntityID:       baseURL + "/sso/metadata",
		SPACSURL:         baseURL + "/sso/acs",
		SPCertificate:    cfg.SPCertificate,
		SPPrivateKey:     cfg.SPPrivateKey,
		NameIDFormat:     cfg.NameIDFormat,
		AttributeMapping: attrMapping,
	})
}

// buildSSOLoginURL constructs the SSO login URL based on sso_type.
func (ctrl *Ctrl) buildSSOLoginURL(c *fox.Context) string {
	ctx := c.Logger.WithContext(c.Request.Context())

	ssoType := ctrl.service.GetSSOType(ctx)
	// Determine scheme: prefer X-Forwarded-Proto header (reverse proxy), fallback to TLS
	scheme := "https"
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if c.Request.TLS == nil {
		scheme = "http"
	}
	baseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	switch ssoType {
	case "oidc":
		cfg, err := ctrl.service.GetOIDCConfig(ctx)
		if err != nil || cfg == nil {
			return ""
		}
		provider, err := sso.NewOIDCProvider(ctx, cfg.Issuer, cfg.ClientID, cfg.ClientSecret)
		if err != nil {
			return ""
		}
		state := ctrl.generateSSOState(c, "/")
		return provider.AuthURL(state, baseURL+"/sso/callback")

	case "saml":
		provider, err := ctrl.getSAMLProvider(c)
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
	ctx := c.Logger.WithContext(c.Request.Context())

	expiry := strconv.FormatInt(time.Now().Add(10*time.Minute).Unix(), 10)
	payload := redirect + "|" + expiry
	mac := hmac.New(sha256.New, []byte(ctrl.service.GetJWTSecret()))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	state := base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + sig))

	// Store in cookie for validation
	secure := ctrl.service.IsCookieSecure(ctx)
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
	ctx := c.Logger.WithContext(c.Request.Context())
	secure := ctrl.service.IsCookieSecure(ctx)

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
