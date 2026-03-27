package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBuildLocalCallbackMux(t *testing.T) {
	results := make(chan ssoCallbackResult, 1)
	handler := buildLocalCallbackMux(results)

	req := httptest.NewRequest(http.MethodGet, "/callback?ticket=test-ticket", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	result := <-results
	if result.Ticket != "test-ticket" {
		t.Fatalf("ticket = %q, want %q", result.Ticket, "test-ticket")
	}
}

func TestBuildLocalCallbackMux_Error(t *testing.T) {
	results := make(chan ssoCallbackResult, 1)
	handler := buildLocalCallbackMux(results)

	req := httptest.NewRequest(http.MethodGet, "/callback?error=sso_exchange_failed", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}

	result := <-results
	if result.Error != "sso_exchange_failed" {
		t.Fatalf("error = %q, want %q", result.Error, "sso_exchange_failed")
	}
}
