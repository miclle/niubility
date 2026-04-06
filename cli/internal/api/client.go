// Package api provides HTTP client for Niubility API
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	clii18n "github.com/miclle/niubility/cli/internal/i18n"
)

const defaultCLIUserAgent = "niubility-cli"

// Client is the API client for Niubility
type Client struct {
	// baseURL is the server base URL (e.g., http://127.0.0.1:9000)
	baseURL *url.URL

	// httpClient is the HTTP client
	httpClient *http.Client

	// timeout for requests
	timeout time.Duration

	accessToken string
	clientType  string
	clientID    string
	clientName  string
	userAgent   string
}

// Errors
var (
	ErrUnauthorized = errors.New(clii18n.T("APIClient.Error.Unauthorized", "unauthorized: please run 'niubility login'", nil))
	ErrForbidden    = errors.New(clii18n.T("APIClient.Error.Forbidden", "forbidden: you don't have permission", nil))
	ErrNotFound     = errors.New(clii18n.T("APIClient.Error.NotFound", "resource not found", nil))
	ErrServer       = errors.New(clii18n.T("APIClient.Error.Server", "server error", nil))
	ErrUploadFailed = errors.New(clii18n.T("APIClient.Error.UploadFailed", "upload failed", nil))
)

// APIError represents an error response from the API
type APIError struct {
	StatusCode int    `json:"-"`
	Message    string `json:"message"`
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return clii18n.T("APIClient.Error.APIErrorStatus", "API error: status {{.Status}}", map[string]interface{}{"Status": e.StatusCode})
}

// NewClient creates a new API client
func NewClient(server string, timeout time.Duration, jar http.CookieJar) (*Client, error) {
	baseURL, err := url.Parse(server)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.InvalidServerURL", "invalid server URL", nil), err)
	}

	// Ensure base URL doesn't have trailing slash
	baseURL.Path = strings.TrimSuffix(baseURL.Path, "/")

	httpClient := &http.Client{
		Timeout:   timeout,
		Jar:       jar,
		Transport: http.DefaultTransport,
	}

	return &Client{
		baseURL:    baseURL,
		httpClient: httpClient,
		timeout:    timeout,
		clientType: "cli",
		userAgent:  defaultCLIUserAgent,
	}, nil
}

// do performs an HTTP request and returns the response
func (c *Client) do(ctx context.Context, method, path string, body, result interface{}) error {
	// Build URL
	u, err := c.baseURL.Parse(path)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.InvalidURLPath", "invalid URL path", nil), err)
	}

	// Encode body
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.EncodeRequestBody", "failed to encode request body", nil), err)
		}
		reqBody = bytes.NewReader(data)
	}

	// Create request
	req, err := http.NewRequestWithContext(ctx, method, u.String(), reqBody)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.CreateRequest", "failed to create request", nil), err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	if c.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	}
	if c.clientType != "" {
		req.Header.Set("X-Niubility-Client-Type", c.clientType)
	}
	if c.clientID != "" {
		req.Header.Set("X-Niubility-Client-ID", c.clientID)
	}
	if c.clientName != "" {
		req.Header.Set("X-Niubility-Client-Name", c.clientName)
	}
	if c.userAgent != "" {
		req.Header.Set("User-Agent", c.userAgent)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.RequestFailed", "request failed", nil), err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.ReadResponseBody", "failed to read response body", nil), err)
	}

	// Handle error status codes
	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.Unmarshal(respBody, &apiErr); err != nil {
			apiErr.Message = string(respBody)
		}
		apiErr.StatusCode = resp.StatusCode

		switch resp.StatusCode {
		case http.StatusUnauthorized:
			return fmt.Errorf("%w: %s", ErrUnauthorized, apiErr.Message)
		case http.StatusForbidden:
			return fmt.Errorf("%w: %s", ErrForbidden, apiErr.Message)
		case http.StatusNotFound:
			return fmt.Errorf("%w: %s", ErrNotFound, apiErr.Message)
		default:
			return &apiErr
		}
	}

	// Decode successful response
	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.DecodeResponse", "failed to decode response", nil), err)
		}
	}

	return nil
}

// Get performs a GET request
func (c *Client) Get(ctx context.Context, path string, result interface{}) error {
	return c.do(ctx, http.MethodGet, path, nil, result)
}

// Post performs a POST request
func (c *Client) Post(ctx context.Context, path string, body, result interface{}) error {
	return c.do(ctx, http.MethodPost, path, body, result)
}

// Patch performs a PATCH request
func (c *Client) Patch(ctx context.Context, path string, body, result interface{}) error {
	return c.do(ctx, http.MethodPatch, path, body, result)
}

// Delete performs a DELETE request
func (c *Client) Delete(ctx context.Context, path string) error {
	return c.do(ctx, http.MethodDelete, path, nil, nil)
}

// Put performs a PUT request to the API
func (c *Client) Put(ctx context.Context, path string, body, result interface{}) error {
	return c.do(ctx, http.MethodPut, path, body, result)
}

// Upload performs a PUT request to a raw URL (for S3 upload)
func (c *Client) Upload(ctx context.Context, url string, contentType string, body io.Reader) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, body)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.CreateUploadRequest", "failed to create upload request", nil), err)
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("%s: %w", clii18n.T("APIClient.Error.UploadRequestFailed", "upload request failed", nil), err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("%w: status %d", ErrUploadFailed, resp.StatusCode)
	}

	return nil
}

// GetBaseURL returns the base URL
func (c *Client) GetBaseURL() string {
	return c.baseURL.String()
}

// SetAccessToken updates the bearer token used for API requests.
func (c *Client) SetAccessToken(token string) {
	c.accessToken = token
}

// SetClientIdentity sets audit-friendly metadata headers for this client.
func (c *Client) SetClientIdentity(clientType, clientID, clientName string) {
	c.clientType = clientType
	c.clientID = clientID
	c.clientName = clientName
}
