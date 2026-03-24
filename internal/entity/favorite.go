package entity

import "time"

// Favorite represents a user's bookmark/favorite on a content item.
type Favorite struct {
	ID        string    `json:"id"         gorm:"column:id;primaryKey;size:36"`
	UserID    string    `json:"user_id"    gorm:"column:user_id;size:36;uniqueIndex:uniq_favorites_user_content;index:idx_favorites_user_id"`
	ContentID string    `json:"content_id" gorm:"column:content_id;size:36;uniqueIndex:uniq_favorites_user_content;index:idx_favorites_content_id"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the database table name for Favorite.
func (Favorite) TableName() string {
	return "favorites"
}

// FavoriteResponse represents the response after toggling a favorite.
type FavoriteResponse struct {
	Favorited     bool  `json:"favorited"`
	FavoriteCount int64 `json:"favorite_count"`
}
