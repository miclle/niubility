package entity

import "time"

// ContentModerationLog records one moderation action applied to a content item.
type ContentModerationLog struct {
	ID                   string              `json:"id"                     gorm:"column:id;primaryKey;size:36"`
	ContentID            string              `json:"content_id"             gorm:"column:content_id;size:36;index:idx_content_moderation_logs_content_id"`
	ReviewerID           string              `json:"reviewer_id"            gorm:"column:reviewer_id;size:36;index:idx_content_moderation_logs_reviewer_id"`
	PreviousReviewStatus ContentReviewStatus `json:"previous_review_status" gorm:"column:previous_review_status;size:32"`
	NewReviewStatus      ContentReviewStatus `json:"new_review_status"      gorm:"column:new_review_status;size:32"`
	PreviousVisibility   ContentVisibility   `json:"previous_visibility"    gorm:"column:previous_visibility;size:32"`
	NewVisibility        ContentVisibility   `json:"new_visibility"         gorm:"column:new_visibility;size:32"`
	ReviewNote           string              `json:"review_note"            gorm:"column:review_note;type:text"`
	CreatedAt            time.Time           `json:"created_at"`

	Content  *Content `json:"content,omitempty"  gorm:"foreignKey:ContentID"`
	Reviewer *User    `json:"reviewer,omitempty" gorm:"foreignKey:ReviewerID"`
}

// TableName specifies the database table name for ContentModerationLog.
func (ContentModerationLog) TableName() string {
	return "content_moderation_logs"
}
