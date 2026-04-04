package auth

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestManagerHasSession(t *testing.T) {
	token := testJWTWithExpiry(t, time.Now().Add(time.Hour))

	mgr, err := NewManager(token, "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	if !mgr.HasSession() {
		t.Fatal("HasSession() = false, want true")
	}
}

func TestManagerHasSessionExpiredToken(t *testing.T) {
	token := testJWTWithExpiry(t, time.Now().Add(-time.Hour))

	mgr, err := NewManager(token, "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	if mgr.HasSession() {
		t.Fatal("HasSession() = true, want false")
	}
}

func TestManagerSyncFromJar(t *testing.T) {
	token := testJWTWithExpiry(t, time.Now().Add(time.Hour))

	mgr, err := NewManager("", "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	serverURL, err := url.Parse("http://example.com:9000")
	if err != nil {
		t.Fatalf("url.Parse() error = %v", err)
	}
	mgr.GetJar().SetCookies(serverURL, []*http.Cookie{{
		Name:  authCookieName,
		Value: token,
		Path:  "/",
	}})

	if err := mgr.SyncFromJar(); err != nil {
		t.Fatalf("SyncFromJar() error = %v", err)
	}
	if got := mgr.GetAccessToken(); got != token {
		t.Fatalf("GetAccessToken() = %q, want %q", got, token)
	}
}

func TestManagerGetClientName(t *testing.T) {
	mgr, err := NewManager("", "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}
	if strings.TrimSpace(mgr.GetClientName()) == "" {
		t.Fatal("GetClientName() should not be empty")
	}
}

func TestParseJWTExpiry(t *testing.T) {
	exp := time.Now().Add(2 * time.Hour).Unix()
	token := testJWTWithExpiry(t, time.Unix(exp, 0))

	got, err := parseJWTExpiry(token)
	if err != nil {
		t.Fatalf("parseJWTExpiry() error = %v", err)
	}
	if got.Unix() != exp {
		t.Fatalf("parseJWTExpiry() = %d, want %d", got.Unix(), exp)
	}
}

func testJWTWithExpiry(t *testing.T, expiry time.Time) string {
	t.Helper()

	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payloadBody := map[string]any{"exp": expiry.Unix()}
	payloadJSON, err := json.Marshal(payloadBody)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	payload := base64.RawURLEncoding.EncodeToString(payloadJSON)
	return strings.Join([]string{header, payload, "signature"}, ".")
}

func TestDefaultClientName(t *testing.T) {
	if strings.TrimSpace(defaultClientName()) == "" {
		t.Fatal("defaultClientName() should not be empty")
	}
}
