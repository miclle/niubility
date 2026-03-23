package entity

import "time"

// TargetType represents the type of a likeable target.
type TargetType string

const (
	// TargetTypeContent indicates a content item.
	TargetTypeContent TargetType = "content"
	// TargetTypeComment indicates a comment.
	TargetTypeComment TargetType = "comment"
	// TargetTypeAttachment indicates an attachment (image/video in gallery).
	TargetTypeAttachment TargetType = "attachment"
)

// Like represents a user's like on a content or comment.
type Like struct {
	ID         string     `json:"id"          gorm:"column:id;primaryKey;size:36"`
	UserID     string     `json:"user_id"     gorm:"column:user_id;size:36;uniqueIndex:uniq_likes_user_target"`
	TargetID   string     `json:"target_id"   gorm:"column:target_id;size:36;uniqueIndex:uniq_likes_user_target"`
	TargetType TargetType `json:"target_type" gorm:"column:target_type;size:32;uniqueIndex:uniq_likes_user_target"`
	CreatedAt  time.Time  `json:"created_at"`
}

// TableName specifies the database table name for Like.
func (Like) TableName() string {
	return "likes"
}

// LikeResponse represents the response after toggling a like.
type LikeResponse struct {
	Liked     bool  `json:"liked"`
	LikeCount int64 `json:"like_count"`
}
