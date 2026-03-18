// Package sso provides SSO authentication via standard protocols (OIDC, SAML 2.0).
package sso

import "context"

// UserInfo represents authenticated user information from an SSO provider.
type UserInfo struct {
	Username string
	Email    string
	Name     string
}

// CallbackParams holds callback parameters from the identity provider.
type CallbackParams struct {
	// OIDC fields.
	Code  string
	State string

	// SAML fields.
	SAMLResponse string
	RelayState   string
}

// Provider defines the SSO authentication interface.
type Provider interface {
	// AuthURL returns the URL to redirect the user to for authentication.
	AuthURL(state, callbackURL string) string
	// Exchange processes the callback and returns user info.
	Exchange(ctx context.Context, params CallbackParams) (*UserInfo, error)
}
