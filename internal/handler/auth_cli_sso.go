package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/pkg/sso"
)

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
