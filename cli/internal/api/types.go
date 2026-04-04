// Package api provides API types for Niubility
package api

import (
	"fmt"
	"net/url"
)

// User represents a user
type User struct {
	ID             string            `json:"id"`
	Username       string            `json:"username"`
	Name           string            `json:"name"`
	Email          string            `json:"email"`
	Mobile         string            `json:"mobile"`
	Avatar         string            `json:"avatar"`
	Bio            string            `json:"bio"`
	Location       string            `json:"location"`
	SocialAccounts map[string]string `json:"social_accounts"`
	DepartmentIDs  string            `json:"department_ids"`
	Role           string            `json:"role"`
	Status         string            `json:"status"`
	FollowerCount  int64             `json:"follower_count"`
	FollowingCount int64             `json:"following_count"`
	CreatedAt      string            `json:"created_at"`
	UpdatedAt      string            `json:"updated_at"`
}

// UserListResponse represents the response for user list
type UserListResponse struct {
	Items      []User `json:"items"`
	NextCursor string `json:"next_cursor,omitempty"`
	Total      *int64 `json:"total,omitempty"`
}

// HasMore returns true if there are more results
func (r *UserListResponse) HasMore() bool {
	return r.NextCursor != ""
}

// UserListOptions represents options for listing users
type UserListOptions struct {
	Limit        int    `json:"limit"`
	Cursor       string `json:"cursor"`
	Search       string `json:"search"`
	DepartmentID int64  `json:"department_id"`
}

// ToQuery converts options to URL query parameters
func (o *UserListOptions) ToQuery() url.Values {
	q := url.Values{}
	if o.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", o.Limit))
	}
	if o.Cursor != "" {
		q.Set("cursor", o.Cursor)
	}
	if o.Search != "" {
		q.Set("search", o.Search)
	}
	if o.DepartmentID > 0 {
		q.Set("department_id", fmt.Sprintf("%d", o.DepartmentID))
	}
	return q
}

// CreateUserRequest represents create user request
type CreateUserRequest struct {
	Username       string            `json:"username"`
	Email          string            `json:"email"`
	Password       *string           `json:"password,omitempty"`
	Name           *string           `json:"name,omitempty"`
	Mobile         *string           `json:"mobile,omitempty"`
	Avatar         *string           `json:"avatar,omitempty"`
	Bio            *string           `json:"bio,omitempty"`
	Location       *string           `json:"location,omitempty"`
	SocialAccounts map[string]string `json:"social_accounts,omitempty"`
	DepartmentIDs  *string           `json:"department_ids,omitempty"`
	Role           *string           `json:"role,omitempty"`
	Status         *string           `json:"status,omitempty"`
	CreatedAt      *string           `json:"created_at,omitempty"`
	UpdatedAt      *string           `json:"updated_at,omitempty"`
}

// UpdateUserRequest represents update user request
type UpdateUserRequest struct {
	Username       *string           `json:"username,omitempty"`
	Email          *string           `json:"email,omitempty"`
	Password       *string           `json:"password,omitempty"`
	Name           *string           `json:"name,omitempty"`
	Mobile         *string           `json:"mobile,omitempty"`
	Avatar         *string           `json:"avatar,omitempty"`
	Bio            *string           `json:"bio,omitempty"`
	Location       *string           `json:"location,omitempty"`
	SocialAccounts map[string]string `json:"social_accounts,omitempty"`
	DepartmentIDs  *string           `json:"department_ids,omitempty"`
	Role           *string           `json:"role,omitempty"`
	Status         *string           `json:"status,omitempty"`
	CreatedAt      *string           `json:"created_at,omitempty"`
	UpdatedAt      *string           `json:"updated_at,omitempty"`
}

// Category represents a content category
type Category struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Slug         string `json:"slug"`
	Icon         string `json:"icon"`
	Visible      bool   `json:"visible"`
	SortOrder    int    `json:"sort_order"`
	ContentCount int64  `json:"content_count"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// CategoryListResponse represents the response for category list
type CategoryListResponse struct {
	Categories []Category `json:"categories"`
}

// ContentStatus represents content status
type ContentStatus string

const (
	ContentStatusDraft     ContentStatus = "draft"
	ContentStatusPublished ContentStatus = "published"
)

// ContentType represents content type
type ContentType string

const (
	ContentTypeArticle ContentType = "article"
	ContentTypeGallery ContentType = "gallery"
	ContentTypeVideo   ContentType = "video"
)

// Content represents a content item
type Content struct {
	ID            string        `json:"id"`
	AuthorID      string        `json:"author_id"`
	Title         string        `json:"title"`
	Summary       string        `json:"summary"`
	Body          string        `json:"body"`
	CoverURL      string        `json:"cover_url"`
	Type          ContentType   `json:"type"`
	Status        ContentStatus `json:"status"`
	Category      string        `json:"category"`
	Tags          []string      `json:"tags"`
	SpeakerID     string        `json:"speaker_id"`
	SpeakerName   string        `json:"speaker_name"`
	SpeakerBio    string        `json:"speaker_bio"`
	LikeCount     int64         `json:"like_count"`
	FavoriteCount int64         `json:"favorite_count"`
	CommentCount  int64         `json:"comment_count"`
	CreatedAt     string        `json:"created_at"`
	UpdatedAt     string        `json:"updated_at"`

	Author      *User        `json:"author,omitempty"`
	Speaker     *User        `json:"speaker,omitempty"`
	Attachments []Attachment `json:"attachments,omitempty"`
}

// Attachment represents a file attached to content
type Attachment struct {
	ID          string  `json:"id"`
	ContentID   string  `json:"content_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Filename    string  `json:"filename"`
	URL         string  `json:"url"`
	CoverURL    string  `json:"cover_url"`
	MimeType    string  `json:"mime_type"`
	Checksum    string  `json:"checksum"`
	Type        string  `json:"type"` // video, image, document
	SortOrder   int     `json:"sort_order"`
	IsCover     bool    `json:"is_cover"`
	Width       int     `json:"width"`
	Height      int     `json:"height"`
	FileSize    int64   `json:"file_size"`
	Duration    float64 `json:"duration"`
	LikeCount   int64   `json:"like_count"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// ContentListResponse represents the response for content list
type ContentListResponse struct {
	Items      []Content `json:"items"`
	NextCursor string    `json:"next_cursor,omitempty"`
}

// HasMore returns true if there are more results
func (r *ContentListResponse) HasMore() bool {
	return r.NextCursor != ""
}

// BootResponse represents the response for boot endpoint
type BootResponse struct {
	Initialized    bool       `json:"initialized"`
	Authentication string     `json:"authentication"` // "authorized" or "unauthorized"
	User           *User      `json:"user,omitempty"`
	Categories     []Category `json:"categories"`
	AllowRegister  bool       `json:"registration_enabled"`
	EnableSSO      bool       `json:"sso_enabled"`
	SSOLoginURL    string     `json:"sso_login_url,omitempty"`
}

// IsAuthenticated returns true if the user is authenticated
func (b *BootResponse) IsAuthenticated() bool {
	return b.Authentication == "authorized"
}

// LoginRequest represents login request
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse represents login response
type LoginResponse struct {
	User User `json:"user"`
}

// CLISSOStartRequest represents the request body for creating a CLI SSO login session.
type CLISSOStartRequest struct {
	CallbackURL string `json:"callback_url"`
}

// CLISSOStartResponse represents the response body for creating a CLI SSO login session.
type CLISSOStartResponse struct {
	LoginID    string `json:"login_id"`
	BrowserURL string `json:"browser_url"`
	ExpiresIn  int    `json:"expires_in"`
}

// CLISSOExchangeRequest represents the request body for exchanging a CLI SSO ticket.
type CLISSOExchangeRequest struct {
	Ticket string `json:"ticket"`
}

// PresignRequest represents presign URL request
type PresignRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"` // MIME type like "image/png"
}

// PresignResponse represents presign URL response
type PresignResponse struct {
	Key          string `json:"key"`
	PresignedURL string `json:"presigned_url"`
}

// CreateContentRequest represents create content request
type CreateContentRequest struct {
	Title       string        `json:"title"`
	Summary     string        `json:"summary"`
	Body        string        `json:"body"`
	CoverURL    string        `json:"cover_url"`
	Type        ContentType   `json:"type"`
	Status      ContentStatus `json:"status"`
	Category    string        `json:"category"`
	Tags        []string      `json:"tags"`
	SpeakerID   string        `json:"speaker_id"`
	SpeakerName string        `json:"speaker_name"`
	SpeakerBio  string        `json:"speaker_bio"`
	Attachments []Attachment  `json:"attachments"`
}

// UpdateContentRequest represents update content request.
// All fields are pointers; only non-nil fields will be updated.
type UpdateContentRequest struct {
	Title       *string        `json:"title,omitempty"`
	Summary     *string        `json:"summary,omitempty"`
	Body        *string        `json:"body,omitempty"`
	CoverURL    *string        `json:"cover_url,omitempty"`
	Type        *ContentType   `json:"type,omitempty"`
	Status      *ContentStatus `json:"status,omitempty"`
	Category    *string        `json:"category,omitempty"`
	Tags        []string       `json:"tags,omitempty"`
	SpeakerID   *string        `json:"speaker_id,omitempty"`
	SpeakerName *string        `json:"speaker_name,omitempty"`
	SpeakerBio  *string        `json:"speaker_bio,omitempty"`
	Attachments []Attachment   `json:"attachments,omitempty"`
}

// ContentListOptions represents options for listing contents
type ContentListOptions struct {
	Limit          int    `json:"limit"`
	Cursor         string `json:"cursor"`
	Category       string `json:"category"`
	Type           string `json:"type"`
	Status         string `json:"status"`
	Keyword        string `json:"keyword"`
	Tag            string `json:"tag"`
	Sort           string `json:"sort"`
	AuthorID       string `json:"author_id"`
	SpeakerID      string `json:"speaker_id"`
	FollowedByUser string `json:"followed_by_user_id"`
}

// ToQuery converts options to URL query parameters
func (o *ContentListOptions) ToQuery() url.Values {
	q := url.Values{}
	if o.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", o.Limit))
	}
	if o.Cursor != "" {
		q.Set("cursor", o.Cursor)
	}
	if o.Category != "" {
		q.Set("category", o.Category)
	}
	if o.Type != "" {
		q.Set("type", o.Type)
	}
	if o.Status != "" {
		q.Set("status", o.Status)
	}
	if o.Keyword != "" {
		q.Set("keyword", o.Keyword)
	}
	if o.Tag != "" {
		q.Set("tag", o.Tag)
	}
	if o.Sort != "" {
		q.Set("sort", o.Sort)
	}
	if o.AuthorID != "" {
		q.Set("author_id", o.AuthorID)
	}
	if o.SpeakerID != "" {
		q.Set("speaker_id", o.SpeakerID)
	}
	if o.FollowedByUser != "" {
		q.Set("followed_by_user_id", o.FollowedByUser)
	}
	return q
}

// Comment represents a comment
type Comment struct {
	ID           string  `json:"id"`
	ContentID    string  `json:"content_id"`
	AttachmentID string  `json:"attachment_id"`
	UserID       string  `json:"user_id"`
	ParentID     string  `json:"parent_id"`
	ReplyToID    string  `json:"reply_to_id"`
	Body         string  `json:"body"`
	LikeCount    int64   `json:"like_count"`
	PinnedAt     *string `json:"pinned_at"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`

	User    *User     `json:"user,omitempty"`
	ReplyTo *Comment  `json:"reply_to,omitempty"`
	Replies []Comment `json:"replies,omitempty"`
}

// CommentListResponse represents the response for comment list
type CommentListResponse struct {
	Items           []Comment `json:"items"`
	NextCursor      string    `json:"next_cursor,omitempty"`
	Total           int64     `json:"total"`
	LikedCommentIDs []string  `json:"liked_comment_ids"`
}

// HasMore returns true if there are more results
func (r *CommentListResponse) HasMore() bool {
	return r.NextCursor != ""
}

// CommentListOptions represents options for listing comments
type CommentListOptions struct {
	Limit        int    `json:"limit"`
	Cursor       string `json:"cursor"`
	ContentID    string `json:"content_id"`
	AttachmentID string `json:"attachment_id"`
}

// ToQuery converts options to URL query parameters
func (o *CommentListOptions) ToQuery() url.Values {
	q := url.Values{}
	if o.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", o.Limit))
	}
	if o.Cursor != "" {
		q.Set("cursor", o.Cursor)
	}
	if o.ContentID != "" {
		q.Set("content_id", o.ContentID)
	}
	if o.AttachmentID != "" {
		q.Set("attachment_id", o.AttachmentID)
	}
	return q
}

// CreateCommentRequest represents create comment request
type CreateCommentRequest struct {
	ContentID    string `json:"content_id"`
	AttachmentID string `json:"attachment_id,omitempty"`
	ParentID     string `json:"parent_id,omitempty"`
	ReplyToID    string `json:"reply_to_id,omitempty"`
	Body         string `json:"body"`
}

// LikeResponse represents the response for toggling a like
type LikeResponse struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"like_count"`
}

// ToggleLikeRequest represents the request for toggling a like
type ToggleLikeRequest struct {
	TargetType string `json:"target_type"` // content, comment, attachment
	TargetID   string `json:"target_id"`
}

// FavoriteResponse represents the response for toggling a favorite
type FavoriteResponse struct {
	Favorited     bool  `json:"favorited"`
	FavoriteCount int64 `json:"favorite_count"`
}

// FollowResponse represents the response for toggling a follow
type FollowResponse struct {
	Following      bool  `json:"following"`
	FollowerCount  int64 `json:"follower_count"`
	FollowingCount int64 `json:"following_count"`
}

// PaginationOptions represents common pagination parameters
type PaginationOptions struct {
	Limit  int    `json:"limit"`
	Cursor string `json:"cursor"`
}

// ToQuery converts options to URL query parameters
func (o *PaginationOptions) ToQuery() url.Values {
	q := url.Values{}
	if o.Limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", o.Limit))
	}
	if o.Cursor != "" {
		q.Set("cursor", o.Cursor)
	}
	return q
}

// CreateCategoryRequest represents create category request
type CreateCategoryRequest struct {
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	Icon      string `json:"icon,omitempty"`
	SortOrder int    `json:"sort_order,omitempty"`
}

// UpdateCategoryRequest represents update category request
type UpdateCategoryRequest struct {
	Name      *string `json:"name,omitempty"`
	Slug      *string `json:"slug,omitempty"`
	Icon      *string `json:"icon,omitempty"`
	Visible   *bool   `json:"visible,omitempty"`
	SortOrder *int    `json:"sort_order,omitempty"`
}

// ReorderCategoryItem represents a single item in a reorder request
type ReorderCategoryItem struct {
	ID        string `json:"id"`
	SortOrder int    `json:"sort_order"`
}

// ReorderCategoriesRequest represents reorder categories request
type ReorderCategoriesRequest struct {
	Items []ReorderCategoryItem `json:"items"`
}

// UpdateProfileRequest represents update profile request
type UpdateProfileRequest struct {
	Name           *string           `json:"name,omitempty"`
	Bio            *string           `json:"bio,omitempty"`
	Location       *string           `json:"location,omitempty"`
	Avatar         *string           `json:"avatar,omitempty"`
	SocialAccounts map[string]string `json:"social_accounts,omitempty"`
}

// ChangePasswordRequest represents change password request
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}

// ChangePasswordResponse represents change password response
type ChangePasswordResponse struct {
	Message string `json:"message"`
}

// HasPasswordResponse represents has-password response
type HasPasswordResponse struct {
	HasPassword bool `json:"has_password"`
}

// Setting represents a key-value setting
type Setting struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updated_at"`
}

// ListSettingsResponse represents the response for listing settings
type ListSettingsResponse struct {
	Settings []Setting `json:"settings"`
}

// UpdateSettingsRequest represents update settings request
type UpdateSettingsRequest struct {
	Settings map[string]string `json:"settings"`
}
