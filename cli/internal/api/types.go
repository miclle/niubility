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
	Initialized       bool       `json:"initialized"`
	Authentication    string     `json:"authentication"` // "authorized" or "unauthorized"
	User              *User      `json:"user,omitempty"`
	Categories        []Category `json:"categories"`
	AllowRegister     bool       `json:"registration_enabled"`
	EnableSSO         bool       `json:"sso_enabled"`
	SSOLoginURL       string     `json:"sso_login_url,omitempty"`
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
