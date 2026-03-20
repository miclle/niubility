package service

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ToggleFollow toggles a follow relationship between two users.
// Returns the new follow state and updated counts for the target user.
func (s *Service) ToggleFollow(followerID, followingID string) (*entity.FollowResponse, error) {
	if followerID == followingID {
		return nil, fmt.Errorf("cannot follow yourself")
	}

	var resp entity.FollowResponse

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var existing entity.Follow
		err := tx.Where("follower_id = ? AND following_id = ?", followerID, followingID).
			First(&existing).Error

		if err == nil {
			// Already following — unfollow
			if err := tx.Delete(&existing).Error; err != nil {
				return fmt.Errorf("delete follow: %w", err)
			}
			if err := updateFollowCounts(tx, followerID, followingID, -1); err != nil {
				return err
			}
			resp.Following = false
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			// Not following — follow
			follow := entity.Follow{
				ID:          entity.ID(),
				FollowerID:  followerID,
				FollowingID: followingID,
			}
			if err := tx.Create(&follow).Error; err != nil {
				return fmt.Errorf("create follow: %w", err)
			}
			if err := updateFollowCounts(tx, followerID, followingID, 1); err != nil {
				return err
			}
			resp.Following = true
		} else {
			return fmt.Errorf("check existing follow: %w", err)
		}

		// Read back updated counts for the target user
		var targetUser entity.User
		if err := tx.Select("follower_count", "following_count").Where("id = ?", followingID).First(&targetUser).Error; err != nil {
			return fmt.Errorf("read target user counts: %w", err)
		}
		resp.FollowerCount = targetUser.FollowerCount
		resp.FollowingCount = targetUser.FollowingCount
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &resp, nil
}

// IsFollowing checks whether followerID is following followingID.
func (s *Service) IsFollowing(followerID, followingID string) (bool, error) {
	var count int64
	err := s.DB.Model(&entity.Follow{}).
		Where("follower_id = ? AND following_id = ?", followerID, followingID).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check is following: %w", err)
	}
	return count > 0, nil
}

// ListFollowing returns a paginated list of users that the given user is following.
func (s *Service) ListFollowing(userID string, pagination entity.Pagination) ([]entity.User, int64, error) {
	var total int64
	err := s.DB.Model(&entity.Follow{}).Where("follower_id = ?", userID).Count(&total).Error
	if err != nil {
		return nil, 0, fmt.Errorf("count following: %w", err)
	}

	var users []entity.User
	err = s.DB.
		Joins("JOIN follows ON follows.following_id = users.id").
		Where("follows.follower_id = ?", userID).
		Order("follows.created_at DESC").
		Offset(pagination.Offset()).
		Limit(pagination.GetLimit()).
		Find(&users).Error
	if err != nil {
		return nil, 0, fmt.Errorf("list following: %w", err)
	}

	return users, total, nil
}

// ListFollowers returns a paginated list of users who follow the given user.
func (s *Service) ListFollowers(userID string, pagination entity.Pagination) ([]entity.User, int64, error) {
	var total int64
	err := s.DB.Model(&entity.Follow{}).Where("following_id = ?", userID).Count(&total).Error
	if err != nil {
		return nil, 0, fmt.Errorf("count followers: %w", err)
	}

	var users []entity.User
	err = s.DB.
		Joins("JOIN follows ON follows.follower_id = users.id").
		Where("follows.following_id = ?", userID).
		Order("follows.created_at DESC").
		Offset(pagination.Offset()).
		Limit(pagination.GetLimit()).
		Find(&users).Error
	if err != nil {
		return nil, 0, fmt.Errorf("list followers: %w", err)
	}

	return users, total, nil
}

// updateFollowCounts adjusts follower_count and following_count on both users.
func updateFollowCounts(tx *gorm.DB, followerID, followingID string, delta int) error {
	// Update follower's following_count
	followingExpr := gorm.Expr("GREATEST(following_count + ?, 0)", delta)
	if err := tx.Model(&entity.User{}).Where("id = ?", followerID).UpdateColumn("following_count", followingExpr).Error; err != nil {
		return fmt.Errorf("update following_count: %w", err)
	}
	// Update following's follower_count
	followerExpr := gorm.Expr("GREATEST(follower_count + ?, 0)", delta)
	if err := tx.Model(&entity.User{}).Where("id = ?", followingID).UpdateColumn("follower_count", followerExpr).Error; err != nil {
		return fmt.Errorf("update follower_count: %w", err)
	}
	return nil
}
