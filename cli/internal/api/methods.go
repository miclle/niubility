// Package api provides API methods for Niubility
package api

import (
	"context"
	"fmt"
)

// Boot calls the boot endpoint
func (c *Client) Boot(ctx context.Context) (*BootResponse, error) {
	var resp BootResponse
	if err := c.Get(ctx, "/api/v1/boot", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Login authenticates with username and password
func (c *Client) Login(ctx context.Context, username, password string) (*LoginResponse, error) {
	req := LoginRequest{
		Username: username,
		Password: password,
	}
	var resp LoginResponse
	if err := c.Post(ctx, "/api/v1/login", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Logout logs out the current user
func (c *Client) Logout(ctx context.Context) error {
	return c.Get(ctx, "/logout", nil)
}

// ListCategories lists all categories
func (c *Client) ListCategories(ctx context.Context) ([]Category, error) {
	var resp CategoryListResponse
	if err := c.Get(ctx, "/api/v1/categories", &resp); err != nil {
		return nil, err
	}
	return resp.Categories, nil
}

// ListContents lists contents with options
func (c *Client) ListContents(ctx context.Context, opts *ContentListOptions) (*ContentListResponse, error) {
	path := "/api/v1/contents"
	if opts != nil {
		query := opts.ToQuery()
		if encoded := query.Encode(); encoded != "" {
			path = path + "?" + encoded
		}
	}
	var resp ContentListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetContent gets a content by ID
func (c *Client) GetContent(ctx context.Context, id string) (*Content, error) {
	var resp Content
	if err := c.Get(ctx, fmt.Sprintf("/api/v1/contents/%s", id), &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateContent creates a new content
func (c *Client) CreateContent(ctx context.Context, req *CreateContentRequest) (*Content, error) {
	var resp Content
	if err := c.Post(ctx, "/api/v1/contents", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteContent deletes a content by ID
func (c *Client) DeleteContent(ctx context.Context, id string) error {
	return c.Delete(ctx, fmt.Sprintf("/api/v1/contents/%s", id))
}

// PresignUpload gets a presigned URL for file upload
// contentType should be a MIME type like "image/png", "application/pdf"
func (c *Client) PresignUpload(ctx context.Context, filename, contentType string) (*PresignResponse, error) {
	req := PresignRequest{
		Filename:    filename,
		ContentType: contentType,
	}
	var resp PresignResponse
	if err := c.Post(ctx, "/api/v1/upload/presign", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// PresignAvatarUpload gets a presigned URL for avatar upload
// contentType should be a MIME type like "image/png", "image/jpeg"
func (c *Client) PresignAvatarUpload(ctx context.Context, filename, contentType string) (*PresignResponse, error) {
	return c.PresignUpload(ctx, filename, contentType)
}

// GetCurrentUser gets the current logged in user
func (c *Client) GetCurrentUser(ctx context.Context) (*User, error) {
	boot, err := c.Boot(ctx)
	if err != nil {
		return nil, err
	}
	if !boot.IsAuthenticated() || boot.User == nil {
		return nil, fmt.Errorf("not authenticated")
	}
	return boot.User, nil
}
