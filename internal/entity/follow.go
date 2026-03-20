package entity

import "time"

// Follow represents a follow relationship between two users.
type Follow struct {
	ID          string    `json:"id"           gorm:"column:id;primaryKey;size:36"`
	FollowerID  string    `json:"follower_id"  gorm:"column:follower_id;uniqueIndex:uniq_follows_follower_following;index:idx_follows_follower_id"`
	FollowingID string    `json:"following_id" gorm:"column:following_id;uniqueIndex:uniq_follows_follower_following;index:idx_follows_following_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// TableName specifies the database table name for Follow.
func (Follow) TableName() string {
	return "follows"
}

// FollowResponse represents the response after toggling a follow.
type FollowResponse struct {
	Following      bool  `json:"following"`
	FollowerCount  int64 `json:"follower_count"`
	FollowingCount int64 `json:"following_count"`
}
