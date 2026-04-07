package entity

import "time"

// AttachmentType represents the type of an attachment.
type AttachmentType string

const (
	// AttachmentTypeVideo indicates a video attachment.
	AttachmentTypeVideo AttachmentType = "video"
	// AttachmentTypeImage indicates an image attachment.
	AttachmentTypeImage AttachmentType = "image"
	// AttachmentTypeDocument indicates a document attachment (PDF, PPT, DOC, etc.).
	AttachmentTypeDocument AttachmentType = "document"
	// AttachmentTypeAudio indicates an audio attachment.
	AttachmentTypeAudio AttachmentType = "audio"
)

// Attachment represents a file (video, image, etc.) attached to a content.
type Attachment struct {
	ID          string         `json:"id"          gorm:"column:id;primaryKey;size:36"`
	ContentID   string         `json:"content_id"  gorm:"column:content_id;size:36;index:idx_attachments_content_id"`
	Title       string         `json:"title"       gorm:"column:title"`
	Description string         `json:"description" gorm:"column:description"`
	Filename    string         `json:"filename"    gorm:"column:filename"`
	URL         string         `json:"url"         gorm:"column:url"`
	CoverURL    string         `json:"cover_url"   gorm:"column:cover_url"`
	MimeType    string         `json:"mime_type"   gorm:"column:mime_type"`
	Checksum    string         `json:"checksum"    gorm:"column:checksum;size:128;index:idx_attachments_content_checksum"`
	Type        AttachmentType `json:"type"        gorm:"column:type"`
	SortOrder   int            `json:"sort_order"  gorm:"column:sort_order;default:0"`
	IsCover     bool           `json:"is_cover"    gorm:"column:is_cover;default:false"`
	Width       int            `json:"width"       gorm:"column:width;default:0"`
	Height      int            `json:"height"      gorm:"column:height;default:0"`
	FileSize    int64          `json:"file_size"   gorm:"column:file_size;default:0"`
	Duration    float64        `json:"duration"    gorm:"column:duration;default:0"`
	LikeCount   int64          `json:"like_count"  gorm:"column:like_count;default:0"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// TableName specifies the database table name for Attachment.
func (Attachment) TableName() string {
	return "attachments"
}

// CreateAttachmentArgs represents the fields required to create an attachment.
type CreateAttachmentArgs struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Filename    string         `json:"filename"`
	URL         string         `json:"url"         binding:"required"`
	CoverURL    string         `json:"cover_url"`
	MimeType    string         `json:"mime_type"`
	Checksum    string         `json:"checksum"`
	Type        AttachmentType `json:"type"        binding:"required"`
	SortOrder   int            `json:"sort_order"`
	IsCover     bool           `json:"is_cover"`
	Width       int            `json:"width"`
	Height      int            `json:"height"`
	FileSize    int64          `json:"file_size"`
	Duration    float64        `json:"duration"`
}
