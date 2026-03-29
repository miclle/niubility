package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net"
	"net/http"
	"net/url"
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

// CLISSOStartRequest represents the request body for creating a CLI SSO login request.
type CLISSOStartRequest struct {
	CallbackURL string `json:"callback_url" binding:"required"`
}

// CLISSOStartResponse represents the response body for creating a CLI SSO login request.
type CLISSOStartResponse struct {
	LoginID    string `json:"login_id"`
	BrowserURL string `json:"browser_url"`
	ExpiresIn  int    `json:"expires_in"`
}

// CLISSOLoginArgs represents the query parameters for starting browser-based CLI SSO.
type CLISSOLoginArgs struct {
	Request string `query:"request"`
}

// CLISSOExchangeRequest represents the request body for exchanging a CLI SSO ticket.
type CLISSOExchangeRequest struct {
	Ticket string `json:"ticket" binding:"required"`
}

type cliSSOStatePayload struct {
	CallbackURL string `json:"callback_url"`
	Expiry      int64  `json:"exp"`
}

type cliSSOTicketPayload struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Expiry   int64  `json:"exp"`
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

	redirect, err := ctrl.validateSSOState(c, args.State)
	if err == nil {
		return ctrl.completeSSOLogin(c, userinfo, redirect)
	}

	callbackURL, cliErr := ctrl.validateCLISSOState(args.State)
	if cliErr == nil {
		return ctrl.completeCLISSOLogin(c, callbackURL, userinfo)
	}

	c.Logger.Errorf("invalid SSO state: web=%v cli=%v", err, cliErr)
	return render.Redirect{Code: 302, Location: "/login"}
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

	callbackURL, cliErr := ctrl.validateCLISSOState(args.RelayState)
	if cliErr == nil {
		return ctrl.completeCLISSOLogin(c, callbackURL, userinfo)
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
	user, err := ctrl.resolveSSOUser(c, userinfo)
	if err != nil {
		c.Logger.Errorf("resolve SSO user failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}
	if err := ctrl.setAuthCookieForUser(c, user); err != nil {
		c.Logger.Errorf("set auth cookie failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	if redirect == "" {
		redirect = "/"
	}

	return render.Redirect{Code: 302, Location: redirect}
}

// CLISSOStart registers a pending CLI SSO login and returns the browser URL.
func (ctrl *Ctrl) CLISSOStart(c *fox.Context, req *CLISSOStartRequest) (any, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) == "disabled" {
		return nil, httperrors.New(http.StatusBadRequest, "SSO 未启用")
	}

	if err := validateCLICallbackURL(req.CallbackURL); err != nil {
		return nil, httperrors.New(http.StatusBadRequest, err.Error())
	}

	requestToken, err := ctrl.generateCLISSOState(req.CallbackURL)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	baseURL := ctrl.baseURL(c)
	browserURL := fmt.Sprintf("%s/api/v1/sso/cli/login?request=%s", baseURL, url.QueryEscape(requestToken))

	return &CLISSOStartResponse{
		LoginID:    requestToken,
		BrowserURL: browserURL,
		ExpiresIn:  300,
	}, nil
}

// CLISSOLogin redirects the browser to the configured IdP for CLI SSO.
func (ctrl *Ctrl) CLISSOLogin(c *fox.Context, args *CLISSOLoginArgs) any {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) == "disabled" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	if _, err := ctrl.validateCLISSOState(args.Request); err != nil {
		return httperrors.ErrNotFound
	}

	switch ctrl.service.GetSSOType(ctx) {
	case "oidc":
		provider, err := ctrl.getOIDCProvider(ctx)
		if err != nil {
			c.Logger.Errorf("get OIDC provider: %v", err)
			return ctrl.redirectCLISSOFailure(c, args.Request, "sso_provider_error")
		}
		return render.Redirect{Code: 302, Location: provider.AuthURL(args.Request, ctrl.baseURL(c)+"/sso/callback")}

	case "saml":
		provider, err := ctrl.getSAMLProvider(c)
		if err != nil {
			c.Logger.Errorf("get SAML provider: %v", err)
			return ctrl.redirectCLISSOFailure(c, args.Request, "sso_provider_error")
		}
		return render.Redirect{Code: 302, Location: provider.AuthURL(args.Request, "")}

	default:
		return render.Redirect{Code: 302, Location: "/login"}
	}
}

// CLISSOExchange consumes a CLI SSO ticket and creates an authenticated session.
func (ctrl *Ctrl) CLISSOExchange(c *fox.Context, req *CLISSOExchangeRequest) (any, error) {
	userinfo, err := ctrl.validateCLISSOTicket(req.Ticket)
	if err != nil {
		return nil, httperrors.New(http.StatusUnauthorized, "ticket 无效或已过期")
	}

	user, err := ctrl.resolveSSOUser(c, userinfo)
	if err != nil {
		c.Logger.Errorf("resolve SSO user failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	if err := ctrl.setAuthCookieForUser(c, user); err != nil {
		c.Logger.Errorf("set auth cookie failed: %v", err)
		return nil, httperrors.ErrInternalServerError
	}
	return &LoginResponse{User: user}, nil
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
		SPEntityID:       ctrl.baseURL(c) + "/sso/metadata",
		SPACSURL:         ctrl.baseURL(c) + "/sso/acs",
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
	baseURL := ctrl.baseURL(c)

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

func (ctrl *Ctrl) baseURL(c *fox.Context) string {
	scheme := "https"
	if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if c.Request.TLS == nil {
		scheme = "http"
	}
	return fmt.Sprintf("%s://%s", scheme, c.Request.Host)
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

// generateCLISSOState creates a signed CLI SSO request token.
func (ctrl *Ctrl) generateCLISSOState(callbackURL string) (string, error) {
	return ctrl.signCLIToken(cliSSOStatePayload{
		CallbackURL: callbackURL,
		Expiry:      time.Now().Add(10 * time.Minute).Unix(),
	})
}

// validateCLISSOState validates the CLI SSO request token and returns the callback URL.
func (ctrl *Ctrl) validateCLISSOState(state string) (string, error) {
	var payload cliSSOStatePayload
	if err := ctrl.verifyCLIToken(state, &payload); err != nil {
		return "", err
	}
	if payload.Expiry < time.Now().Unix() {
		return "", fmt.Errorf("state expired")
	}
	if err := validateCLICallbackURL(payload.CallbackURL); err != nil {
		return "", err
	}
	return payload.CallbackURL, nil
}

func (ctrl *Ctrl) resolveSSOUser(c *fox.Context, userinfo *sso.UserInfo) (*entity.User, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	if userinfo == nil || userinfo.Username == "" {
		return nil, fmt.Errorf("SSO user username is empty")
	}

	user, err := ctrl.service.UpsertUser(ctx, userinfo.Username, userinfo.Email)
	if err != nil {
		return nil, fmt.Errorf("upsert user: %w", err)
	}

	return user, nil
}

func (ctrl *Ctrl) setAuthCookieForUser(c *fox.Context, user *entity.User) error {
	tokenString, err := ctrl.issueToken(user.Username)
	if err != nil {
		return fmt.Errorf("create jwt token: %w", err)
	}
	ctrl.setAuthCookie(c, tokenString)
	return nil
}

func (ctrl *Ctrl) completeCLISSOLogin(c *fox.Context, callbackURL string, userinfo *sso.UserInfo) any {
	ticket, err := ctrl.generateCLISSOTicket(userinfo)
	if err != nil {
		c.Logger.Errorf("complete CLI SSO login failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	return render.Redirect{Code: 302, Location: callbackURL + "?ticket=" + url.QueryEscape(ticket)}
}

func (ctrl *Ctrl) redirectCLISSOFailure(c *fox.Context, requestToken, reason string) any {
	callbackURL, err := ctrl.validateCLISSOState(requestToken)
	if err != nil {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	return render.Redirect{Code: 302, Location: callbackURL + "?error=" + url.QueryEscape(reason)}
}

func (ctrl *Ctrl) generateCLISSOTicket(userinfo *sso.UserInfo) (string, error) {
	if userinfo == nil || userinfo.Username == "" {
		return "", fmt.Errorf("SSO user username is empty")
	}

	return ctrl.signCLIToken(cliSSOTicketPayload{
		Username: userinfo.Username,
		Email:    userinfo.Email,
		Expiry:   time.Now().Add(2 * time.Minute).Unix(),
	})
}

func (ctrl *Ctrl) validateCLISSOTicket(ticket string) (*sso.UserInfo, error) {
	var payload cliSSOTicketPayload
	if err := ctrl.verifyCLIToken(ticket, &payload); err != nil {
		return nil, err
	}
	if payload.Expiry < time.Now().Unix() {
		return nil, fmt.Errorf("ticket expired")
	}
	if payload.Username == "" {
		return nil, fmt.Errorf("ticket username is empty")
	}

	return &sso.UserInfo{
		Username: payload.Username,
		Email:    payload.Email,
	}, nil
}

func (ctrl *Ctrl) signCLIToken(payload any) (string, error) {
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	encodedPayload := base64.RawURLEncoding.EncodeToString(payloadBytes)
	mac := hmac.New(sha256.New, []byte(ctrl.service.GetJWTSecret()))
	mac.Write([]byte(encodedPayload))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	return encodedPayload + "." + signature, nil
}

func (ctrl *Ctrl) verifyCLIToken(token string, payload any) error {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return fmt.Errorf("invalid token format")
	}

	encodedPayload, signature := parts[0], parts[1]
	mac := hmac.New(sha256.New, []byte(ctrl.service.GetJWTSecret()))
	mac.Write([]byte(encodedPayload))
	expectedSignature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return fmt.Errorf("invalid token signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return fmt.Errorf("decode token payload: %w", err)
	}

	if err := json.Unmarshal(payloadBytes, payload); err != nil {
		return fmt.Errorf("unmarshal token payload: %w", err)
	}

	return nil
}

func validateCLICallbackURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid callback URL: %w", err)
	}
	if u.Scheme != "http" {
		return fmt.Errorf("callback URL must use http")
	}
	if u.Path != "/callback" {
		return fmt.Errorf("callback URL path must be /callback")
	}

	host := u.Hostname()
	if host != "127.0.0.1" && host != "localhost" {
		return fmt.Errorf("callback URL host must be 127.0.0.1 or localhost")
	}

	port := u.Port()
	if port == "" {
		return fmt.Errorf("callback URL port is required")
	}
	if _, err := net.LookupPort("tcp", port); err != nil {
		return fmt.Errorf("invalid callback URL port: %w", err)
	}
	if strings.Contains(u.RawQuery, "=") {
		return fmt.Errorf("callback URL query is not allowed")
	}

	return nil
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
		resp.SSOLoginURL = ctrl.buildSSOLoginURL(c)
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
