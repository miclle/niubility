package entity

import "time"

// ContentView represents the aggregated browsing record for a user on a content item.
type ContentView struct {
	ID            string    `json:"id"              gorm:"column:id;primaryKey;size:36"`
	UserID        string    `json:"user_id"         gorm:"column:user_id;size:36;uniqueIndex:uniq_content_views_user_content;index:idx_content_views_user_last_viewed,priority:1"`
	ContentID     string    `json:"content_id"      gorm:"column:content_id;size:36;uniqueIndex:uniq_content_views_user_content;index:idx_content_views_content_last_viewed,priority:1"`
	FirstViewedAt time.Time `json:"first_viewed_at" gorm:"column:first_viewed_at"`
	LastViewedAt  time.Time `json:"last_viewed_at"  gorm:"column:last_viewed_at;index:idx_content_views_user_last_viewed,priority:2;index:idx_content_views_content_last_viewed,priority:2"`
	ViewCount     int64     `json:"view_count"      gorm:"column:view_count;default:1"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	User    *User    `json:"user,omitempty"    gorm:"foreignKey:UserID"`
	Content *Content `json:"content,omitempty" gorm:"foreignKey:ContentID"`
}

// TableName specifies the database table name for ContentView.
func (ContentView) TableName() string {
	return "content_views"
}

// ListMyContentViewsArgs represents the query parameters for listing the current user's browsing history.
type ListMyContentViewsArgs struct {
	Pagination
	Type ContentType `json:"type" form:"type"`
}

// ContentViewUserItem represents a browsing record entry keyed by viewer.
type ContentViewUserItem struct {
	User          User      `json:"user"`
	FirstViewedAt time.Time `json:"first_viewed_at"`
	LastViewedAt  time.Time `json:"last_viewed_at"`
	ViewCount     int64     `json:"view_count"`
}

// MyContentViewItem represents a browsing record entry keyed by content.
type MyContentViewItem struct {
	Content       Content   `json:"content"`
	FirstViewedAt time.Time `json:"first_viewed_at"`
	LastViewedAt  time.Time `json:"last_viewed_at"`
	ViewCount     int64     `json:"view_count"`
}
