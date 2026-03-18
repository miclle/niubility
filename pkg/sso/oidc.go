package sso

import (
	"context"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

// OIDCProvider implements the Provider interface using OpenID Connect.
type OIDCProvider struct {
	issuer       string
	clientID     string
	clientSecret string
	provider     *oidc.Provider
}

// NewOIDCProvider creates an OIDC provider. It performs OIDC discovery against the issuer.
func NewOIDCProvider(ctx context.Context, issuer, clientID, clientSecret string) (*OIDCProvider, error) {
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery for %s: %w", issuer, err)
	}
	return &OIDCProvider{
		issuer:       issuer,
		clientID:     clientID,
		clientSecret: clientSecret,
		provider:     provider,
	}, nil
}

// oauth2Config returns the oauth2 config with the given callback URL.
func (p *OIDCProvider) oauth2Config(callbackURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     p.clientID,
		ClientSecret: p.clientSecret,
		Endpoint:     p.provider.Endpoint(),
		RedirectURL:  callbackURL,
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}
}

// AuthURL returns the OIDC authorization URL.
func (p *OIDCProvider) AuthURL(state, callbackURL string) string {
	return p.oauth2Config(callbackURL).AuthCodeURL(state)
}

// Exchange exchanges the authorization code for tokens and returns user info.
func (p *OIDCProvider) Exchange(ctx context.Context, params CallbackParams) (*UserInfo, error) {
	// We need the callback URL but it's already configured in the auth request.
	// Use an empty redirect_uri config since the token endpoint uses the code directly.
	cfg := p.oauth2Config("")

	token, err := cfg.Exchange(ctx, params.Code)
	if err != nil {
		return nil, fmt.Errorf("exchange code: %w", err)
	}

	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, fmt.Errorf("no id_token in token response")
	}

	verifier := p.provider.Verifier(&oidc.Config{ClientID: p.clientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, fmt.Errorf("verify id_token: %w", err)
	}

	var claims struct {
		Email             string `json:"email"`
		Name              string `json:"name"`
		PreferredUsername string `json:"preferred_username"`
		Sub               string `json:"sub"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("parse id_token claims: %w", err)
	}

	username := claims.PreferredUsername
	if username == "" {
		username = claims.Email
	}
	if username == "" {
		username = claims.Sub
	}

	return &UserInfo{
		Username: username,
		Email:    claims.Email,
		Name:     claims.Name,
	}, nil
}
