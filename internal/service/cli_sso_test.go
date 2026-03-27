package service

import (
	"context"
	"testing"
	"time"

	"github.com/miclle/niubility/pkg/sso"
)

func TestService_CreateCLISSOLoginRequest(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	req, err := s.CreateCLISSOLoginRequest(ctx, "http://127.0.0.1:54321/callback")
	if err != nil {
		t.Fatalf("CreateCLISSOLoginRequest() error = %v", err)
	}
	if req.ID == "" {
		t.Fatal("CreateCLISSOLoginRequest() returned empty ID")
	}
	if req.CallbackURL != "http://127.0.0.1:54321/callback" {
		t.Fatalf("CallbackURL = %q", req.CallbackURL)
	}

	stored, ok := s.GetCLISSOLoginRequest(ctx, req.ID)
	if !ok || stored == nil {
		t.Fatal("GetCLISSOLoginRequest() did not return stored request")
	}
}

func TestService_CreateCLISSOLoginRequest_RejectsInvalidCallback(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	tests := []string{
		"https://127.0.0.1:54321/callback",
		"http://example.com:54321/callback",
		"http://127.0.0.1/callback",
		"http://127.0.0.1:54321/other",
		"http://127.0.0.1:54321/callback?foo=bar",
	}

	for _, callbackURL := range tests {
		t.Run(callbackURL, func(t *testing.T) {
			if _, err := s.CreateCLISSOLoginRequest(ctx, callbackURL); err == nil {
				t.Fatalf("CreateCLISSOLoginRequest(%q) expected error, got nil", callbackURL)
			}
		})
	}
}

func TestService_CompleteAndConsumeCLISSOTicket(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	req, err := s.CreateCLISSOLoginRequest(ctx, "http://127.0.0.1:54321/callback")
	if err != nil {
		t.Fatalf("CreateCLISSOLoginRequest() error = %v", err)
	}

	ticket, callbackURL, err := s.CompleteCLISSOLoginRequest(ctx, req.ID, &sso.UserInfo{
		Username: "cli-user",
		Email:    "cli@example.com",
	})
	if err != nil {
		t.Fatalf("CompleteCLISSOLoginRequest() error = %v", err)
	}
	if ticket == "" {
		t.Fatal("CompleteCLISSOLoginRequest() returned empty ticket")
	}
	if callbackURL != req.CallbackURL {
		t.Fatalf("callbackURL = %q, want %q", callbackURL, req.CallbackURL)
	}

	userinfo, err := s.ConsumeCLISSOTicket(ctx, ticket)
	if err != nil {
		t.Fatalf("ConsumeCLISSOTicket() error = %v", err)
	}
	if userinfo.Username != "cli-user" {
		t.Fatalf("Username = %q, want %q", userinfo.Username, "cli-user")
	}

	if _, err := s.ConsumeCLISSOTicket(ctx, ticket); err == nil {
		t.Fatal("ConsumeCLISSOTicket() expected single-use ticket error, got nil")
	}
}

func TestService_FailCLISSOLoginRequest(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	req, err := s.CreateCLISSOLoginRequest(ctx, "http://localhost:54321/callback")
	if err != nil {
		t.Fatalf("CreateCLISSOLoginRequest() error = %v", err)
	}

	callbackURL, ok := s.FailCLISSOLoginRequest(ctx, req.ID)
	if !ok {
		t.Fatal("FailCLISSOLoginRequest() = not found, want found")
	}
	if callbackURL != req.CallbackURL {
		t.Fatalf("callbackURL = %q, want %q", callbackURL, req.CallbackURL)
	}

	if _, ok := s.GetCLISSOLoginRequest(ctx, req.ID); ok {
		t.Fatal("GetCLISSOLoginRequest() should not find consumed request")
	}
}

func TestService_CLISSOStateExpires(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	s.cliSSOLogins = map[string]*CLISSOLoginRequest{
		"expired": {
			ID:          "expired",
			CallbackURL: "http://127.0.0.1:54321/callback",
			ExpiresAt:   time.Now().Add(-time.Minute),
		},
	}
	s.cliSSOTickets = map[string]*CLISSOTicket{
		"expired-ticket": {
			Token:     "expired-ticket",
			Username:  "cli-user",
			Email:     "cli@example.com",
			ExpiresAt: time.Now().Add(-time.Minute),
		},
	}

	if _, ok := s.GetCLISSOLoginRequest(ctx, "expired"); ok {
		t.Fatal("expired login request should have been cleaned up")
	}
	if _, err := s.ConsumeCLISSOTicket(ctx, "expired-ticket"); err == nil {
		t.Fatal("expired ticket should not be consumable")
	}
}
