package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/sso"
)

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

// buildSSOLoginURL constructs the SSO login URL based on sso_type.
func (ctrl *Ctrl) buildSSOLoginURL(c *fox.Context, redirect string) string {
	ctx := c.Logger.WithContext(c.Request.Context())

	ssoType := ctrl.service.GetSSOType(ctx)
	baseURL := ctrl.baseURL(c)
	if redirect == "" {
		redirect = "/"
	}

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
		state := ctrl.generateSSOState(c, redirect)
		return provider.AuthURL(state, baseURL+"/sso/callback")

	case "saml":
		provider, err := ctrl.getSAMLProvider(c)
		if err != nil {
			return ""
		}
		return provider.AuthURL(redirect, "")

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
	tokenString, err := ctrl.startUserSession(c, user)
	if err != nil {
		return fmt.Errorf("create jwt token: %w", err)
	}
	ctrl.setAuthCookie(c, tokenString)
	return nil
}
