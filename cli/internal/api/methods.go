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

// StartCLISSO creates a pending CLI SSO login session.
func (c *Client) StartCLISSO(ctx context.Context, callbackURL string) (*CLISSOStartResponse, error) {
	req := CLISSOStartRequest{CallbackURL: callbackURL}
	var resp CLISSOStartResponse
	if err := c.Post(ctx, "/api/v1/sso/cli/start", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ExchangeCLISSOTicket exchanges a one-time CLI SSO ticket for an authenticated session.
func (c *Client) ExchangeCLISSOTicket(ctx context.Context, ticket string) (*LoginResponse, error) {
	req := CLISSOExchangeRequest{Ticket: ticket}
	var resp LoginResponse
	if err := c.Post(ctx, "/api/v1/sso/cli/exchange", req, &resp); err != nil {
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

// UpdateContent updates an existing content
func (c *Client) UpdateContent(ctx context.Context, id string, req *UpdateContentRequest) (*Content, error) {
	var resp Content
	if err := c.Put(ctx, fmt.Sprintf("/api/v1/contents/%s", id), req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
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

// ListUsers lists users with admin-only filters
func (c *Client) ListUsers(ctx context.Context, opts *UserListOptions) (*UserListResponse, error) {
	path := "/api/v1/admin/users"
	if opts != nil {
		query := opts.ToQuery()
		if encoded := query.Encode(); encoded != "" {
			path = path + "?" + encoded
		}
	}
	var resp UserListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetUser gets a user by ID
func (c *Client) GetUser(ctx context.Context, id string) (*User, error) {
	var resp User
	if err := c.Get(ctx, fmt.Sprintf("/api/v1/admin/users/%s", id), &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateUser creates a user
func (c *Client) CreateUser(ctx context.Context, req *CreateUserRequest) (*User, error) {
	var resp User
	if err := c.Post(ctx, "/api/v1/admin/users", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// UpdateUser updates a user
func (c *Client) UpdateUser(ctx context.Context, id string, req *UpdateUserRequest) (*User, error) {
	var resp User
	if err := c.Patch(ctx, fmt.Sprintf("/api/v1/admin/users/%s", id), req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteUser deletes a user by ID
func (c *Client) DeleteUser(ctx context.Context, id string) error {
	return c.Delete(ctx, fmt.Sprintf("/api/v1/admin/users/%s", id))
}

// ListComments lists comments for a content item
func (c *Client) ListComments(ctx context.Context, opts *CommentListOptions) (*CommentListResponse, error) {
	path := "/api/v1/comments"
	if opts != nil {
		query := opts.ToQuery()
		if encoded := query.Encode(); encoded != "" {
			path = path + "?" + encoded
		}
	}
	var resp CommentListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CreateComment creates a new comment
func (c *Client) CreateComment(ctx context.Context, req *CreateCommentRequest) (*Comment, error) {
	var resp Comment
	if err := c.Post(ctx, "/api/v1/comments", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// DeleteComment deletes a comment by ID
func (c *Client) DeleteComment(ctx context.Context, id string) error {
	return c.Delete(ctx, fmt.Sprintf("/api/v1/comments/%s", id))
}

// ToggleLike toggles like on a content, comment, or attachment
func (c *Client) ToggleLike(ctx context.Context, targetType, targetID string) (*LikeResponse, error) {
	req := ToggleLikeRequest{TargetType: targetType, TargetID: targetID}
	var resp LikeResponse
	if err := c.Post(ctx, "/api/v1/likes", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ToggleFavorite toggles favorite on a content item
func (c *Client) ToggleFavorite(ctx context.Context, contentID string) (*FavoriteResponse, error) {
	var resp FavoriteResponse
	if err := c.Post(ctx, fmt.Sprintf("/api/v1/contents/%s/favorite", contentID), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListFavorites lists the current user's favorited contents
func (c *Client) ListFavorites(ctx context.Context, opts *PaginationOptions) (*ContentListResponse, error) {
	path := "/api/v1/favorites"
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

// ToggleFollow toggles follow on a user
func (c *Client) ToggleFollow(ctx context.Context, username string) (*FollowResponse, error) {
	var resp FollowResponse
	if err := c.Post(ctx, fmt.Sprintf("/api/v1/users/%s/follow", username), nil, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListFollowing lists users that a user is following
func (c *Client) ListFollowing(ctx context.Context, username string, opts *PaginationOptions) (*UserListResponse, error) {
	path := fmt.Sprintf("/api/v1/users/%s/following", username)
	if opts != nil {
		query := opts.ToQuery()
		if encoded := query.Encode(); encoded != "" {
			path = path + "?" + encoded
		}
	}
	var resp UserListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListFollowers lists followers of a user
func (c *Client) ListFollowers(ctx context.Context, username string, opts *PaginationOptions) (*UserListResponse, error) {
	path := fmt.Sprintf("/api/v1/users/%s/followers", username)
	if opts != nil {
		query := opts.ToQuery()
		if encoded := query.Encode(); encoded != "" {
			path = path + "?" + encoded
		}
	}
	var resp UserListResponse
	if err := c.Get(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}
