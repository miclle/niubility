package sso

import (
	"context"
	"testing"
)

func TestUserInfo_Fields(t *testing.T) {
	info := UserInfo{
		Username: "testuser",
		Email:    "test@example.com",
		Name:     "Test User",
	}

	if info.Username != "testuser" {
		t.Errorf("Username = %q, want %q", info.Username, "testuser")
	}
	if info.Email != "test@example.com" {
		t.Errorf("Email = %q, want %q", info.Email, "test@example.com")
	}
	if info.Name != "Test User" {
		t.Errorf("Name = %q, want %q", info.Name, "Test User")
	}
}

func TestCallbackParams_Fields(t *testing.T) {
	params := CallbackParams{
		Code:         "auth_code",
		State:        "state_value",
		SAMLResponse: "saml_response",
		RelayState:   "relay_state",
	}

	if params.Code != "auth_code" {
		t.Errorf("Code = %q, want %q", params.Code, "auth_code")
	}
	if params.State != "state_value" {
		t.Errorf("State = %q, want %q", params.State, "state_value")
	}
	if params.SAMLResponse != "saml_response" {
		t.Errorf("SAMLResponse = %q, want %q", params.SAMLResponse, "saml_response")
	}
	if params.RelayState != "relay_state" {
		t.Errorf("RelayState = %q, want %q", params.RelayState, "relay_state")
	}
}

// MockProvider is a mock implementation of Provider interface for testing
type MockProvider struct {
	authURLFunc  func(state, callbackURL string) string
	exchangeFunc func(ctx context.Context, params CallbackParams) (*UserInfo, error)
}

func (m *MockProvider) AuthURL(state, callbackURL string) string {
	if m.authURLFunc != nil {
		return m.authURLFunc(state, callbackURL)
	}
	return "https://example.com/auth?state=" + state
}

func (m *MockProvider) Exchange(ctx context.Context, params CallbackParams) (*UserInfo, error) {
	if m.exchangeFunc != nil {
		return m.exchangeFunc(ctx, params)
	}
	return &UserInfo{Username: "mockuser"}, nil
}

// TestProviderInterface verifies the Provider interface is properly defined
func TestProviderInterface(t *testing.T) {
	var _ Provider = &MockProvider{}

	provider := &MockProvider{
		authURLFunc: func(state, callbackURL string) string {
			return "https://example.com/auth?state=" + state + "&redirect=" + callbackURL
		},
	}

	url := provider.AuthURL("test-state", "https://app.example.com/callback")
	expected := "https://example.com/auth?state=test-state&redirect=https://app.example.com/callback"
	if url != expected {
		t.Errorf("AuthURL() = %q, want %q", url, expected)
	}
}
