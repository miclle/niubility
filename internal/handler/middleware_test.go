package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestAcceptsHTML(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		accept string
		want   bool
	}{
		{name: "html", accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", want: true},
		{name: "wildcard", accept: "*/*", want: false},
		{name: "image", accept: "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5", want: false},
		{name: "json", accept: "application/json", want: false},
		{name: "empty", accept: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodGet, "http://example.com/", nil)
			if tt.accept != "" {
				req.Header.Set("Accept", tt.accept)
			}

			if got := requestAcceptsHTML(req); got != tt.want {
				t.Fatalf("requestAcceptsHTML() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCurrentRequestRedirectPath(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "http://example.com/articles/go?tab=comments", nil)
	if got := currentRequestRedirectPath(req); got != "/articles/go?tab=comments" {
		t.Fatalf("currentRequestRedirectPath() = %q, want %q", got, "/articles/go?tab=comments")
	}
}

func TestShouldRedirectPageRequestToSSO(t *testing.T) {
	t.Parallel()

	t.Run("redirect html page when sso enabled", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "http://example.com/articles/go", nil)
		req.Header.Set("Accept", "text/html,application/xhtml+xml")

		if !shouldRedirectPageRequestToSSO(req, true) {
			t.Fatal("shouldRedirectPageRequestToSSO() = false, want true")
		}
	})

	t.Run("skip login page", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "http://example.com/login", nil)
		req.Header.Set("Accept", "text/html")

		if shouldRedirectPageRequestToSSO(req, true) {
			t.Fatal("shouldRedirectPageRequestToSSO() = true, want false")
		}
	})

	t.Run("skip non html resource request", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "http://example.com/site-resources/logo.png", nil)
		req.Header.Set("Accept", "image/avif,image/webp,image/png")

		if shouldRedirectPageRequestToSSO(req, true) {
			t.Fatal("shouldRedirectPageRequestToSSO() = true, want false")
		}
	})

	t.Run("skip when sso disabled", func(t *testing.T) {
		t.Parallel()

		req := httptest.NewRequest(http.MethodGet, "http://example.com/", nil)
		req.Header.Set("Accept", "text/html")

		if shouldRedirectPageRequestToSSO(req, false) {
			t.Fatal("shouldRedirectPageRequestToSSO() = true, want false")
		}
	})
}
