package cmd

import (
	"context"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
)

func TestResolveLoginMode(t *testing.T) {
	t.Cleanup(resetLoginFlags)

	t.Run("use explicit sso flag", func(t *testing.T) {
		resetLoginFlags()
		loginSSO = true

		client := newTestAPIClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatalf("unexpected request to %s", r.URL.Path)
		}))

		mode, err := resolveLoginMode(context.Background(), client)
		if err != nil {
			t.Fatalf("resolveLoginMode() error = %v", err)
		}
		if mode != loginModeSSO {
			t.Fatalf("resolveLoginMode() = %q, want %q", mode, loginModeSSO)
		}
	})

	t.Run("keep password mode when username provided", func(t *testing.T) {
		resetLoginFlags()
		loginUsername = "admin"

		client := newTestAPIClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatalf("unexpected request to %s", r.URL.Path)
		}))

		mode, err := resolveLoginMode(context.Background(), client)
		if err != nil {
			t.Fatalf("resolveLoginMode() error = %v", err)
		}
		if mode != loginModePassword {
			t.Fatalf("resolveLoginMode() = %q, want %q", mode, loginModePassword)
		}
	})

	t.Run("default to sso when server enables it", func(t *testing.T) {
		resetLoginFlags()

		client := newTestAPIClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/api/v1/boot" {
				t.Fatalf("request path = %s, want /api/v1/boot", r.URL.Path)
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"initialized":true,"authentication":"unauthorized","categories":[],"registration_enabled":false,"sso_enabled":true}`))
		}))

		mode, err := resolveLoginMode(context.Background(), client)
		if err != nil {
			t.Fatalf("resolveLoginMode() error = %v", err)
		}
		if mode != loginModeSSO {
			t.Fatalf("resolveLoginMode() = %q, want %q", mode, loginModeSSO)
		}
	})

	t.Run("fall back to password when server disables sso", func(t *testing.T) {
		resetLoginFlags()

		client := newTestAPIClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"initialized":true,"authentication":"unauthorized","categories":[],"registration_enabled":false,"sso_enabled":false}`))
		}))

		mode, err := resolveLoginMode(context.Background(), client)
		if err != nil {
			t.Fatalf("resolveLoginMode() error = %v", err)
		}
		if mode != loginModePassword {
			t.Fatalf("resolveLoginMode() = %q, want %q", mode, loginModePassword)
		}
	})

	t.Run("fall back to password when boot fails", func(t *testing.T) {
		resetLoginFlags()

		client := newTestAPIClient(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, `{"message":"boom"}`, http.StatusInternalServerError)
		}))

		mode, err := resolveLoginMode(context.Background(), client)
		if err != nil {
			t.Fatalf("resolveLoginMode() error = %v", err)
		}
		if mode != loginModePassword {
			t.Fatalf("resolveLoginMode() = %q, want %q", mode, loginModePassword)
		}
	})
}

func newTestAPIClient(t *testing.T, handler http.Handler) *api.Client {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookiejar.New() error = %v", err)
	}

	client, err := api.NewClient(server.URL, time.Second, jar)
	if err != nil {
		t.Fatalf("api.NewClient() error = %v", err)
	}

	return client
}

func resetLoginFlags() {
	loginServer = ""
	loginUsername = ""
	loginPassword = ""
	passwordStdin = false
	loginSSO = false
}
