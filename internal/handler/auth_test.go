package handler

import (
	"strings"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/service"
	"github.com/miclle/niubility/pkg/sso"
)

func TestValidateCLICallbackURL(t *testing.T) {
	t.Parallel()

	validCallbacks := []string{
		"http://127.0.0.1:54321/callback",
		"http://localhost:8080/callback",
	}

	for _, callbackURL := range validCallbacks {
		callbackURL := callbackURL
		t.Run("valid_"+callbackURL, func(t *testing.T) {
			t.Parallel()

			if err := validateCLICallbackURL(callbackURL); err != nil {
				t.Fatalf("validateCLICallbackURL(%q) error = %v", callbackURL, err)
			}
		})
	}

	invalidCallbacks := []string{
		"https://127.0.0.1:54321/callback",
		"http://example.com:54321/callback",
		"http://127.0.0.1/callback",
		"http://127.0.0.1:54321/other",
		"http://127.0.0.1:54321/callback?ticket=abc",
	}

	for _, callbackURL := range invalidCallbacks {
		callbackURL := callbackURL
		t.Run("invalid_"+callbackURL, func(t *testing.T) {
			t.Parallel()

			if err := validateCLICallbackURL(callbackURL); err == nil {
				t.Fatalf("validateCLICallbackURL(%q) expected error, got nil", callbackURL)
			}
		})
	}
}

func TestCLISSOStateRoundTrip(t *testing.T) {
	t.Parallel()

	ctrl := &Ctrl{service: &service.Service{}}
	callbackURL := "http://127.0.0.1:54321/callback"

	token, err := ctrl.generateCLISSOState(callbackURL)
	if err != nil {
		t.Fatalf("generateCLISSOState() error = %v", err)
	}

	gotCallbackURL, err := ctrl.validateCLISSOState(token)
	if err != nil {
		t.Fatalf("validateCLISSOState() error = %v", err)
	}
	if gotCallbackURL != callbackURL {
		t.Fatalf("validateCLISSOState() = %q, want %q", gotCallbackURL, callbackURL)
	}
}

func TestCLISSOStateRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	ctrl := &Ctrl{service: &service.Service{}}
	token, err := ctrl.signCLIToken(cliSSOStatePayload{
		CallbackURL: "http://127.0.0.1:54321/callback",
		Expiry:      time.Now().Add(-time.Minute).Unix(),
	})
	if err != nil {
		t.Fatalf("signCLIToken() error = %v", err)
	}

	if _, err := ctrl.validateCLISSOState(token); err == nil || !strings.Contains(err.Error(), "expired") {
		t.Fatalf("validateCLISSOState() error = %v, want expired error", err)
	}
}

func TestCLISSOTicketRoundTrip(t *testing.T) {
	t.Parallel()

	ctrl := &Ctrl{service: &service.Service{}}
	userinfo := &sso.UserInfo{
		Username: "zhengwei",
		Email:    "zhengwei@example.com",
	}

	ticket, err := ctrl.generateCLISSOTicket(userinfo)
	if err != nil {
		t.Fatalf("generateCLISSOTicket() error = %v", err)
	}

	gotUserinfo, err := ctrl.validateCLISSOTicket(ticket)
	if err != nil {
		t.Fatalf("validateCLISSOTicket() error = %v", err)
	}
	if gotUserinfo.Username != userinfo.Username {
		t.Fatalf("validateCLISSOTicket() username = %q, want %q", gotUserinfo.Username, userinfo.Username)
	}
	if gotUserinfo.Email != userinfo.Email {
		t.Fatalf("validateCLISSOTicket() email = %q, want %q", gotUserinfo.Email, userinfo.Email)
	}
}

func TestCLISSOTicketRejectsTamperedToken(t *testing.T) {
	t.Parallel()

	ctrl := &Ctrl{service: &service.Service{}}
	ticket, err := ctrl.generateCLISSOTicket(&sso.UserInfo{Username: "zhengwei"})
	if err != nil {
		t.Fatalf("generateCLISSOTicket() error = %v", err)
	}

	tamperedTicket := ticket + "tampered"
	if _, err := ctrl.validateCLISSOTicket(tamperedTicket); err == nil {
		t.Fatal("validateCLISSOTicket() expected signature error, got nil")
	}
}
