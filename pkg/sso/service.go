package sso

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
)

// UserInfo represents user information returned from the SSO provider.
type UserInfo struct {
	Email    string `json:"email"`
	Username string `json:"username"`
}

type ssoResp struct {
	Code  int      `json:"code"`
	Error string   `json:"error"`
	Data  UserInfo `json:"data"`
}

// Config holds SSO service configuration.
type Config struct {
	Host     string `json:"host"     yaml:"host"     mapstructure:"host"`
	ClientID string `json:"clientID" yaml:"clientID" mapstructure:"clientID"`
	Secret   string `json:"secret"   yaml:"secret"   mapstructure:"secret"`
}

// Service provides SSO authentication operations.
type Service struct {
	Host     string
	ClientID string
	Secret   string

	conn *http.Client
}

// NewService creates a new SSO Service instance.
func NewService(config Config) *Service {
	return &Service{
		Host:     config.Host,
		ClientID: config.ClientID,
		Secret:   config.Secret,
		conn:     &http.Client{},
	}
}

// GetLoginUserInfo retrieves user info from the SSO provider using an encrypted token.
func (s *Service) GetLoginUserInfo(ctx context.Context, token string) (*UserInfo, error) {
	if len(token) == 0 {
		return nil, ErrTokenEmpty
	}

	realToken, err := AESDecrypt([]byte(s.Secret), token)
	if err != nil {
		return nil, fmt.Errorf("decrypt sso token: %w", err)
	}

	url := fmt.Sprintf("%s/api/userinfo?token=%s&client_id=%s", s.Host, realToken, s.ClientID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create sso request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.conn.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call sso api: %w", err)
	}

	defer func() {
		io.Copy(io.Discard, resp.Body) //nolint:errcheck
		resp.Body.Close()
	}()

	if resp.StatusCode >= 400 {
		return nil, errors.New(http.StatusText(resp.StatusCode))
	}

	ret := &ssoResp{}
	if err := json.NewDecoder(resp.Body).Decode(ret); err != nil {
		return nil, fmt.Errorf("decode sso response: %w", err)
	}

	return &ret.Data, nil
}
