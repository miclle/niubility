// Package auth provides authentication and session management
package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"sync"
)

// Session represents an authenticated session
type Session struct {
	// Cookies stored for the server
	Cookies []*http.Cookie `json:"cookies"`

	// Server URL for the cookies
	Server string `json:"server"`
}

// Manager handles authentication and session persistence
type Manager struct {
	// cookieJarPath is the path to the cookie jar file
	cookieJarPath string

	// jar is the in-memory cookie jar
	jar *cookiejar.Jar

	// server is the base server URL
	server string

	// mu protects concurrent access
	mu sync.RWMutex
}

// Errors
var (
	ErrNoSession = errors.New("no active session, please run 'niubility login'")
)

// NewManager creates a new auth manager
func NewManager(cookieJarPath, server string) (*Manager, error) {
	server = normalizeServerURL(server)

	// Validate server URL
	if _, err := url.Parse(server); err != nil {
		return nil, fmt.Errorf("invalid server URL: %w", err)
	}

	// Create cookie jar
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create cookie jar: %w", err)
	}

	m := &Manager{
		cookieJarPath: cookieJarPath,
		jar:           jar,
		server:        server,
	}

	// Load existing session if available
	if err := m.load(); err != nil && !os.IsNotExist(err) {
		// Log warning but don't fail
		fmt.Fprintf(os.Stderr, "Warning: failed to load session: %v\n", err)
	}

	return m, nil
}

// load loads the session from the cookie jar file
func (m *Manager) load() error {
	data, err := os.ReadFile(m.cookieJarPath)
	if err != nil {
		return err
	}

	var session Session
	if err := json.Unmarshal(data, &session); err != nil {
		return fmt.Errorf("failed to parse session file: %w", err)
	}

	// Only load cookies if they're for the same server
	if normalizeServerURL(session.Server) != "" && normalizeServerURL(session.Server) != m.server {
		return nil
	}

	// Set cookies in the jar
	if len(session.Cookies) > 0 {
		serverURL, err := url.Parse(m.server)
		if err != nil {
			return err
		}

		// Restore host-only cookies from persisted session data.
		// The standard library cookie jar may omit Domain/Path when exporting
		// cookies, but it still needs canonical values when loading them back.
		for _, cookie := range session.Cookies {
			if cookie.Domain == "" {
				cookie.Domain = serverURL.Hostname()
			}
			if cookie.Path == "" {
				cookie.Path = "/"
			}
		}

		m.jar.SetCookies(serverURL, session.Cookies)
	}

	return nil
}

// Save saves the session to the cookie jar file
func (m *Manager) Save() error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Ensure directory exists
	dir := filepath.Dir(m.cookieJarPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create session directory: %w", err)
	}

	// Get cookies from jar
	serverURL, err := url.Parse(m.server)
	if err != nil {
		return err
	}
	cookies := m.jar.Cookies(serverURL)

	session := Session{
		Cookies: cookies,
		Server:  normalizeServerURL(m.server),
	}

	data, err := json.MarshalIndent(session, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal session: %w", err)
	}

	if err := os.WriteFile(m.cookieJarPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write session file: %w", err)
	}

	return nil
}

// Clear clears the session
func (m *Manager) Clear() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Clear cookies in jar
	serverURL, err := url.Parse(m.server)
	if err != nil {
		return err
	}
	m.jar.SetCookies(serverURL, nil)

	// Remove session file
	if err := os.Remove(m.cookieJarPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to remove session file: %w", err)
	}

	return nil
}

// GetJar returns the cookie jar for HTTP client
func (m *Manager) GetJar() http.CookieJar {
	return m.jar
}

// HasSession checks if there's an active session
func (m *Manager) HasSession() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	serverURL, err := url.Parse(m.server)
	if err != nil {
		return false
	}
	cookies := m.jar.Cookies(serverURL)
	return len(cookies) > 0
}

// GetCookieJarPath returns the path to the cookie jar file
func (m *Manager) GetCookieJarPath() string {
	return m.cookieJarPath
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
