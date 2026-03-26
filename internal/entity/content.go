package entity

import "time"

// ContentType represents the type of content.
type ContentType string

const (
	// ContentTypeVideo indicates video content with a playlist.
	ContentTypeVideo ContentType = "video"
	// ContentTypeGallery indicates image/short-video gallery content.
	ContentTypeGallery ContentType = "gallery"
	// ContentTypeArticle indicates a long-form article.
	ContentTypeArticle ContentType = "article"
)

// ReservedSlugs contains slugs reserved for content type routes that cannot be used as category slugs.
var ReservedSlugs = map[string]bool{
	"videos":    true,
	"galleries": true,
	"articles":  true,
}

// ContentStatus represents the publication status of content.
type ContentStatus string

const (
	// ContentStatusDraft indicates unpublished draft content.
	ContentStatusDraft ContentStatus = "draft"
	// ContentStatusPublished indicates published content visible to all.
	ContentStatusPublished ContentStatus = "published"
)

// Content represents a piece of content in the system.
type Content struct {
	ID            string        `json:"id"            gorm:"column:id;primaryKey;size:36"`
	AuthorID      string        `json:"author_id"     gorm:"column:author_id;size:36;index:idx_contents_author_id"`
	Title         string        `json:"title"         gorm:"column:title"`
	Summary       string        `json:"summary"       gorm:"column:summary"`
	Body          string        `json:"body"          gorm:"column:body;type:text"`
	CoverURL      string        `json:"cover_url"     gorm:"column:cover_url"`
	Type          ContentType   `json:"type"          gorm:"column:type"`
	Status        ContentStatus `json:"status"        gorm:"column:status;size:32;default:draft;index:idx_contents_status"`
	Category      string        `json:"category"      gorm:"column:category;size:64;index:idx_contents_category"`
	Tags          []string      `json:"tags"          gorm:"column:tags;serializer:json"`
	SpeakerID     string        `json:"speaker_id"    gorm:"column:speaker_id;size:36;index:idx_contents_speaker_id"`
	SpeakerName   string        `json:"speaker_name"  gorm:"column:speaker_name"`
	SpeakerBio    string        `json:"speaker_bio"   gorm:"column:speaker_bio"`
	LikeCount     int64         `json:"like_count"     gorm:"column:like_count;default:0"`
	FavoriteCount int64         `json:"favorite_count" gorm:"column:favorite_count;default:0"`
	CommentCount  int64         `json:"comment_count"  gorm:"column:comment_count;default:0"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`

	Author      *User        `json:"author,omitempty"      gorm:"foreignKey:AuthorID"`
	Speaker     *User        `json:"speaker,omitempty"     gorm:"foreignKey:SpeakerID"`
	Attachments []Attachment `json:"attachments,omitempty" gorm:"foreignKey:ContentID"`
}

// TableName specifies the database table name for Content.
func (Content) TableName() string {
	return "contents"
}

// SortField represents the field to sort by.
type SortField string

const (
	// SortByCreatedAt sorts by creation time.
	SortByCreatedAt SortField = "created_at"
	// SortByLikeCount sorts by like count.
	SortByLikeCount SortField = "like_count"
)

// ListContentsArgs represents the query parameters for listing contents.
type ListContentsArgs struct {
	Pagination
	Category         string        `json:"category"            form:"category"`
	Type             ContentType   `json:"type"                form:"type"`
	Status           ContentStatus `json:"status"              form:"status"`
	Keyword          string        `json:"keyword"             form:"keyword"`
	Tag              string        `json:"tag"                 form:"tag"`
	Sort             SortField     `json:"sort"                form:"sort"`
	AuthorID         string        `json:"author_id"           form:"author_id"`
	SpeakerID        string        `json:"speaker_id"          form:"speaker_id"`
	FollowedByUserID string        `json:"followed_by_user_id" form:"followed_by_user_id"`
}

// CreateContentArgs represents the fields required to create content.
type CreateContentArgs struct {
	Title       string                 `json:"title"        binding:"required"`
	Summary     string                 `json:"summary"`
	Body        string                 `json:"body"`
	CoverURL    string                 `json:"cover_url"`
	Type        ContentType            `json:"type"         binding:"required"`
	Status      ContentStatus          `json:"status"`
	Category    string                 `json:"category"     binding:"required"`
	Tags        []string               `json:"tags"`
	SpeakerID   string                 `json:"speaker_id"`
	SpeakerName string                 `json:"speaker_name"`
	SpeakerBio  string                 `json:"speaker_bio"`
	Attachments []CreateAttachmentArgs `json:"attachments"`
	// CreatedAt and UpdatedAt can only be set by admin (e.g. for importing legacy content)
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}

// UpdateContentArgs represents the fields that can be updated for content.
type UpdateContentArgs struct {
	Title       *string                `json:"title"`
	Summary     *string                `json:"summary"`
	Body        *string                `json:"body"`
	CoverURL    *string                `json:"cover_url"`
	Type        *ContentType           `json:"type"`
	Status      *ContentStatus         `json:"status"`
	Category    *string                `json:"category"`
	Tags        []string               `json:"tags"`
	SpeakerID   *string                `json:"speaker_id"`
	SpeakerName *string                `json:"speaker_name"`
	SpeakerBio  *string                `json:"speaker_bio"`
	Attachments []CreateAttachmentArgs `json:"attachments"`
	// CreatedAt and UpdatedAt can only be set by admin (e.g. for importing legacy content)
	CreatedAt *time.Time `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at"`
}
