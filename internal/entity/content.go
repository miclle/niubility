package entity

import "time"

// ContentType represents the type of content.
type ContentType string

const (
	// ContentTypeArticle indicates an article (text + images).
	ContentTypeArticle ContentType = "article"
	// ContentTypeVideo indicates a video content.
	ContentTypeVideo ContentType = "video"
)

// ContentCategory represents the category of content.
type ContentCategory string

const (
	// CategoryLearning indicates learning and sharing content.
	CategoryLearning ContentCategory = "learning"
	// CategoryCulture indicates corporate culture content.
	CategoryCulture ContentCategory = "culture"
)

// Content represents a piece of content in the system.
type Content struct {
	ID           string          `json:"id"            gorm:"column:id;primaryKey;size:36"`
	AuthorID     string          `json:"author_id"     gorm:"column:author_id;index:idx_contents_author_id"`
	Title        string          `json:"title"         gorm:"column:title"`
	Summary      string          `json:"summary"       gorm:"column:summary"`
	Body         string          `json:"body"          gorm:"column:body;type:text"`
	CoverURL     string          `json:"cover_url"     gorm:"column:cover_url"`
	VideoURL     string          `json:"video_url"     gorm:"column:video_url"`
	Type         ContentType     `json:"type"          gorm:"column:type"`
	Category     ContentCategory `json:"category"      gorm:"column:category;index:idx_contents_category"`
	Tags         []string        `json:"tags"          gorm:"column:tags;serializer:json"`
	SpeakerID    string          `json:"speaker_id"    gorm:"column:speaker_id;index:idx_contents_speaker_id"`
	SpeakerName  string          `json:"speaker_name"  gorm:"column:speaker_name"`
	SpeakerBio   string          `json:"speaker_bio"   gorm:"column:speaker_bio"`
	LikeCount    int64           `json:"like_count"    gorm:"column:like_count;default:0"`
	CommentCount int64           `json:"comment_count" gorm:"column:comment_count;default:0"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`

	Author  *User `json:"author,omitempty"  gorm:"foreignKey:AuthorID"`
	Speaker *User `json:"speaker,omitempty" gorm:"foreignKey:SpeakerID"`
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
	Category ContentCategory `json:"category" form:"category"`
	Type     ContentType     `json:"type"     form:"type"`
	Keyword  string          `json:"keyword"  form:"keyword"`
	Tag      string          `json:"tag"      form:"tag"`
	Sort     SortField       `json:"sort"     form:"sort"`
}

// CreateContentArgs represents the fields required to create content.
type CreateContentArgs struct {
	Title       string          `json:"title"        binding:"required"`
	Summary     string          `json:"summary"`
	Body        string          `json:"body"`
	CoverURL    string          `json:"cover_url"`
	VideoURL    string          `json:"video_url"`
	Type        ContentType     `json:"type"         binding:"required"`
	Category    ContentCategory `json:"category"     binding:"required"`
	Tags        []string        `json:"tags"`
	SpeakerID   string          `json:"speaker_id"`
	SpeakerName string          `json:"speaker_name"`
	SpeakerBio  string          `json:"speaker_bio"`
}

// UpdateContentArgs represents the fields that can be updated for content.
type UpdateContentArgs struct {
	Title       *string          `json:"title"`
	Summary     *string          `json:"summary"`
	Body        *string          `json:"body"`
	CoverURL    *string          `json:"cover_url"`
	VideoURL    *string          `json:"video_url"`
	Type        *ContentType     `json:"type"`
	Category    *ContentCategory `json:"category"`
	Tags        []string         `json:"tags"`
	SpeakerID   *string          `json:"speaker_id"`
	SpeakerName *string          `json:"speaker_name"`
	SpeakerBio  *string          `json:"speaker_bio"`
}
