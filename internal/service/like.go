package service

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ToggleLike toggles a like for a user on a target (content or comment).
// Returns the new liked state and updated like count.
func (s *Service) ToggleLike(userID, targetID string, targetType entity.TargetType) (*entity.LikeResponse, error) {
	var resp entity.LikeResponse

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		var existing entity.Like
		err := tx.Where("user_id = ? AND target_id = ? AND target_type = ?", userID, targetID, targetType).
			First(&existing).Error

		if err == nil {
			// Already liked — unlike
			if err := tx.Delete(&existing).Error; err != nil {
				return fmt.Errorf("delete like: %w", err)
			}
			if err := updateLikeCount(tx, targetID, targetType, -1); err != nil {
				return err
			}
			resp.Liked = false
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			// Not liked — like
			like := entity.Like{
				ID:         entity.ID(),
				UserID:     userID,
				TargetID:   targetID,
				TargetType: targetType,
			}
			if err := tx.Create(&like).Error; err != nil {
				return fmt.Errorf("create like: %w", err)
			}
			if err := updateLikeCount(tx, targetID, targetType, 1); err != nil {
				return err
			}
			resp.Liked = true
		} else {
			return fmt.Errorf("check existing like: %w", err)
		}

		// Read back the updated like_count
		count, err := getLikeCount(tx, targetID, targetType)
		if err != nil {
			return err
		}
		resp.LikeCount = count
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &resp, nil
}

// IsLiked checks whether a user has liked a specific target.
func (s *Service) IsLiked(userID, targetID string, targetType entity.TargetType) (bool, error) {
	var count int64
	err := s.DB.Model(&entity.Like{}).
		Where("user_id = ? AND target_id = ? AND target_type = ?", userID, targetID, targetType).
		Count(&count).Error
	if err != nil {
		return false, fmt.Errorf("check is liked: %w", err)
	}
	return count > 0, nil
}

// GetLikedIDs returns the subset of targetIDs that the user has liked.
func (s *Service) GetLikedIDs(userID string, targetIDs []string, targetType entity.TargetType) ([]string, error) {
	if len(targetIDs) == 0 {
		return nil, nil
	}
	var ids []string
	err := s.DB.Model(&entity.Like{}).
		Where("user_id = ? AND target_id IN ? AND target_type = ?", userID, targetIDs, targetType).
		Pluck("target_id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("get liked ids: %w", err)
	}
	return ids, nil
}

// updateLikeCount adjusts the like_count on the target's table.
func updateLikeCount(tx *gorm.DB, targetID string, targetType entity.TargetType, delta int) error {
	var model any
	switch targetType {
	case entity.TargetTypeContent:
		model = &entity.Content{}
	case entity.TargetTypeComment:
		model = &entity.Comment{}
	default:
		return fmt.Errorf("unknown target type: %s", targetType)
	}
	expr := gorm.Expr("GREATEST(like_count + ?, 0)", delta)
	if err := tx.Model(model).Where("id = ?", targetID).UpdateColumn("like_count", expr).Error; err != nil {
		return fmt.Errorf("update like_count for %s: %w", targetType, err)
	}
	return nil
}

// getLikeCount reads the current like_count from the target's table.
func getLikeCount(tx *gorm.DB, targetID string, targetType entity.TargetType) (int64, error) {
	var count int64
	switch targetType {
	case entity.TargetTypeContent:
		err := tx.Model(&entity.Content{}).Where("id = ?", targetID).Pluck("like_count", &count).Error
		return count, err
	case entity.TargetTypeComment:
		err := tx.Model(&entity.Comment{}).Where("id = ?", targetID).Pluck("like_count", &count).Error
		return count, err
	default:
		return 0, fmt.Errorf("unknown target type: %s", targetType)
	}
}
