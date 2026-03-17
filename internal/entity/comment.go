package entity

import "time"

// Comment represents a comment on a content item.
type Comment struct {
	ID        string    `json:"id"          gorm:"column:id;primaryKey;size:36"`
	ContentID string    `json:"content_id"  gorm:"column:content_id;index:idx_comments_content_id"`
	UserID    string    `json:"user_id"     gorm:"column:user_id;index:idx_comments_user_id"`
	ParentID  string    `json:"parent_id"   gorm:"column:parent_id;index:idx_comments_parent_id"`
	ReplyToID string    `json:"reply_to_id" gorm:"column:reply_to_id"`
	Body      string    `json:"body"        gorm:"column:body;type:text"`
	LikeCount int64     `json:"like_count"  gorm:"column:like_count;default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User    *User     `json:"user,omitempty"     gorm:"foreignKey:UserID"`
	ReplyTo *Comment  `json:"reply_to,omitempty" gorm:"foreignKey:ReplyToID"`
	Replies []Comment `json:"replies,omitempty"  gorm:"foreignKey:ParentID"`
}

// TableName specifies the database table name for Comment.
func (Comment) TableName() string {
	return "comments"
}

// CreateCommentArgs represents the fields required to create a comment.
type CreateCommentArgs struct {
	Body      string `json:"body"        binding:"required"`
	ParentID  string `json:"parent_id"`
	ReplyToID string `json:"reply_to_id"`
}
