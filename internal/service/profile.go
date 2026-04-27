package service

import (
	"context"
	"fmt"

	"github.com/fox-gonic/fox/logger"

	"github.com/miclle/niubility/internal/entity"
)

// UpdateProfile updates a user's own profile fields by ID.
func (s *Service) UpdateProfile(ctx context.Context, id string, args entity.UpdateProfileArgs) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	user, err := s.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	updates := map[string]any{}
	if args.Name != nil {
		updates["name"] = *args.Name
	}
	if args.Bio != nil {
		updates["bio"] = *args.Bio
	}
	if args.Location != nil {
		updates["location"] = *args.Location
	}
	if args.Avatar != nil {
		updates["avatar"] = *args.Avatar
	}
	// SocialAccounts uses GORM's serializer:json tag, which is not honored by map-based Updates.
	// Apply it separately via struct-based update so the serializer encodes it as JSON.
	if args.SocialAccounts != nil {
		user.SocialAccounts = args.SocialAccounts
		if err := s.db.WithContext(ctx).Model(user).Select("social_accounts").Updates(user).Error; err != nil {
			log.Errorf("update profile social_accounts: %v", err)
			return nil, fmt.Errorf("update profile social_accounts: %w", err)
		}
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
			log.Errorf("update profile: %v", err)
			return nil, fmt.Errorf("update profile: %w", err)
		}
	}

	return s.GetUserByID(ctx, id)
}

// GetUserContentCount returns the number of contents authored by the given user.
func (s *Service) GetUserContentCount(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).
		Where("author_id = ?", userID).
		Scopes(scopePublicListVisible).
		Count(&count).Error; err != nil {
		log.Errorf("count user contents: %v", err)
		return 0, fmt.Errorf("count user contents: %w", err)
	}
	return count, nil
}

// GetUserTotalLikes returns the total like count across all contents authored by the given user.
func (s *Service) GetUserTotalLikes(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var total int64
	err := s.db.WithContext(ctx).
		Model(&entity.Content{}).
		Where("author_id = ?", userID).
		Scopes(scopePublicListVisible).
		Select("COALESCE(SUM(like_count), 0)").
		Scan(&total).Error
	if err != nil {
		log.Errorf("sum user likes: %v", err)
		return 0, fmt.Errorf("sum user likes: %w", err)
	}
	return total, nil
}

// GetUserSpeakerContentCount returns the number of contents where the given user is the speaker.
func (s *Service) GetUserSpeakerContentCount(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).
		Where("speaker_id = ?", userID).
		Scopes(scopePublicListVisible).
		Count(&count).Error; err != nil {
		log.Errorf("count speaker contents: %v", err)
		return 0, fmt.Errorf("count speaker contents: %w", err)
	}
	return count, nil
}
