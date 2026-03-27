package service

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/miclle/niubility/pkg/sso"
)

const (
	cliSSOLoginTTL  = 5 * time.Minute
	cliSSOTicketTTL = 2 * time.Minute
)

// CreateCLISSOLoginRequest registers a pending CLI SSO login request.
func (s *Service) CreateCLISSOLoginRequest(_ context.Context, callbackURL string) (*CLISSOLoginRequest, error) {
	if err := validateCLICallbackURL(callbackURL); err != nil {
		return nil, err
	}

	requestID, err := generateHexKey(16)
	if err != nil {
		return nil, fmt.Errorf("generate login request id: %w", err)
	}

	req := &CLISSOLoginRequest{
		ID:          requestID,
		CallbackURL: callbackURL,
		ExpiresAt:   time.Now().Add(cliSSOLoginTTL),
	}

	s.cliSSOMutex.Lock()
	defer s.cliSSOMutex.Unlock()

	s.cleanupExpiredCLISSOStateLocked()
	if s.cliSSOLogins == nil {
		s.cliSSOLogins = make(map[string]*CLISSOLoginRequest)
	}
	s.cliSSOLogins[req.ID] = req

	return req, nil
}

// GetCLISSOLoginRequest retrieves a pending CLI SSO login request by ID.
func (s *Service) GetCLISSOLoginRequest(_ context.Context, requestID string) (*CLISSOLoginRequest, bool) {
	s.cliSSOMutex.Lock()
	defer s.cliSSOMutex.Unlock()

	s.cleanupExpiredCLISSOStateLocked()
	req, ok := s.cliSSOLogins[requestID]
	return req, ok
}

// FailCLISSOLoginRequest removes a pending request and returns its callback URL.
func (s *Service) FailCLISSOLoginRequest(_ context.Context, requestID string) (string, bool) {
	s.cliSSOMutex.Lock()
	defer s.cliSSOMutex.Unlock()

	s.cleanupExpiredCLISSOStateLocked()
	req, ok := s.cliSSOLogins[requestID]
	if !ok {
		return "", false
	}
	delete(s.cliSSOLogins, requestID)
	return req.CallbackURL, true
}

// CompleteCLISSOLoginRequest issues a one-time ticket and consumes the pending request.
func (s *Service) CompleteCLISSOLoginRequest(_ context.Context, requestID string, userinfo *sso.UserInfo) (string, string, error) {
	if userinfo == nil || userinfo.Username == "" {
		return "", "", fmt.Errorf("SSO user username is empty")
	}

	ticket, err := generateHexKey(32)
	if err != nil {
		return "", "", fmt.Errorf("generate ticket: %w", err)
	}

	s.cliSSOMutex.Lock()
	defer s.cliSSOMutex.Unlock()

	s.cleanupExpiredCLISSOStateLocked()
	req, ok := s.cliSSOLogins[requestID]
	if !ok {
		return "", "", fmt.Errorf("CLI SSO login request not found")
	}

	if s.cliSSOTickets == nil {
		s.cliSSOTickets = make(map[string]*CLISSOTicket)
	}
	s.cliSSOTickets[ticket] = &CLISSOTicket{
		Token:     ticket,
		Username:  userinfo.Username,
		Email:     userinfo.Email,
		ExpiresAt: time.Now().Add(cliSSOTicketTTL),
	}
	delete(s.cliSSOLogins, requestID)

	return ticket, req.CallbackURL, nil
}

// ConsumeCLISSOTicket validates and consumes a one-time CLI SSO ticket.
func (s *Service) ConsumeCLISSOTicket(_ context.Context, ticket string) (*sso.UserInfo, error) {
	if ticket == "" {
		return nil, fmt.Errorf("ticket is required")
	}

	s.cliSSOMutex.Lock()
	defer s.cliSSOMutex.Unlock()

	s.cleanupExpiredCLISSOStateLocked()
	stored, ok := s.cliSSOTickets[ticket]
	if !ok {
		return nil, fmt.Errorf("invalid or expired ticket")
	}
	delete(s.cliSSOTickets, ticket)

	return &sso.UserInfo{
		Username: stored.Username,
		Email:    stored.Email,
	}, nil
}

func (s *Service) cleanupExpiredCLISSOStateLocked() {
	now := time.Now()

	for id, req := range s.cliSSOLogins {
		if req.ExpiresAt.Before(now) {
			delete(s.cliSSOLogins, id)
		}
	}

	for token, ticket := range s.cliSSOTickets {
		if ticket.ExpiresAt.Before(now) {
			delete(s.cliSSOTickets, token)
		}
	}
}

func validateCLICallbackURL(raw string) error {
	u, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("invalid callback URL: %w", err)
	}
	if u.Scheme != "http" {
		return fmt.Errorf("callback URL must use http")
	}
	if u.Path != "/callback" {
		return fmt.Errorf("callback URL path must be /callback")
	}

	host := u.Hostname()
	if host != "127.0.0.1" && host != "localhost" {
		return fmt.Errorf("callback URL host must be 127.0.0.1 or localhost")
	}

	port := u.Port()
	if port == "" {
		return fmt.Errorf("callback URL port is required")
	}
	if _, err := net.LookupPort("tcp", port); err != nil {
		return fmt.Errorf("invalid callback URL port: %w", err)
	}

	if strings.Contains(u.RawQuery, "=") {
		return fmt.Errorf("callback URL query is not allowed")
	}

	return nil
}
