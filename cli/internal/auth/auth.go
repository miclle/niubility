// Package auth provides authentication and session helpers for the CLI.
package auth

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"time"
)

const authCookieName = "NIUBILITY"

// Manager keeps the current CLI auth state in memory.
type Manager struct {
	jar         *cookiejar.Jar
	server      string
	accessToken string
	clientName  string
}

// Errors
var (
	ErrNoSession = errors.New("no active session, please run 'niubility login'")
)

// NewManager creates a new auth manager.
func NewManager(token, server string) (*Manager, error) {
	server = normalizeServerURL(server)

	if _, err := url.Parse(server); err != nil {
		return nil, fmt.Errorf("invalid server URL: %w", err)
	}

	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create cookie jar: %w", err)
	}

	return &Manager{
		jar:         jar,
		server:      server,
		accessToken: strings.TrimSpace(token),
		clientName:  defaultClientName(),
	}, nil
}

// Clear clears the local session token and login-flow cookies.
func (m *Manager) Clear() error {
	serverURL, err := url.Parse(m.server)
	if err != nil {
		return err
	}
	m.jar.SetCookies(serverURL, nil)
	m.accessToken = ""
	return nil
}

// GetJar returns the cookie jar used by login flows that still receive Set-Cookie.
func (m *Manager) GetJar() http.CookieJar {
	return m.jar
}

// HasSession checks if there is an active local token.
func (m *Manager) HasSession() bool {
	if m.accessToken == "" {
		return false
	}

	expiry, err := parseJWTExpiry(m.accessToken)
	if err != nil {
		return false
	}

	return time.Now().Before(expiry)
}

// GetAccessToken returns the local bearer token.
func (m *Manager) GetAccessToken() string {
	return m.accessToken
}

// GetClientName returns the runtime client name used for audit headers.
func (m *Manager) GetClientName() string {
	return m.clientName
}

// SyncFromJar extracts the auth token from the current cookie jar after login.
func (m *Manager) SyncFromJar() error {
	serverURL, err := url.Parse(m.server)
	if err != nil {
		return err
	}

	for _, cookie := range m.jar.Cookies(serverURL) {
		if cookie.Name == authCookieName && cookie.Value != "" {
			m.accessToken = cookie.Value
			return nil
		}
	}

	return ErrNoSession
}

func normalizeServerURL(raw string) string {
	if raw == "" {
		return raw
	}

	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}

	if u.Path == "/" {
		u.Path = ""
	}

	return u.String()
}

func parseJWTExpiry(token string) (time.Time, error) {
	parts := strings.Split(token, ".")
	if len(parts) < 2 {
		return time.Time{}, fmt.Errorf("invalid jwt format")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return time.Time{}, fmt.Errorf("decode jwt payload: %w", err)
	}

	var claims struct {
		Exp int64 `json:"exp"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return time.Time{}, fmt.Errorf("parse jwt payload: %w", err)
	}
	if claims.Exp <= 0 {
		return time.Time{}, fmt.Errorf("jwt exp missing")
	}

	return time.Unix(claims.Exp, 0), nil
}

func defaultClientName() string {
	host, err := os.Hostname()
	if err != nil || strings.TrimSpace(host) == "" {
		return "Niubility CLI"
	}
	return host
}
