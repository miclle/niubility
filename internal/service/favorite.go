package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ToggleFavorite toggles a favorite for a user on a content item.
// Returns the new favorited state and updated favorite count.
func (s *Service) ToggleFavorite(ctx context.Context, userID, contentID string) (*entity.FavoriteResponse, error) {
	log := logger.NewWithContext(ctx)

	var resp entity.FavoriteResponse

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing entity.Favorite
		err := tx.Where("user_id = ? AND content_id = ?", userID, contentID).
			First(&existing).Error

		if err == nil {
			// Already favorited — unfavorite
			if err := tx.Delete(&existing).Error; err != nil {
				return fmt.Errorf("delete favorite: %w", err)
			}
			if err := updateFavoriteCount(tx, contentID, -1); err != nil {
				return fmt.Errorf("update favorite count: %w", err)
			}
			resp.Favorited = false
		} else if errors.Is(err, gorm.ErrRecordNotFound) {
			// Not favorited — favorite
			fav := entity.Favorite{
				ID:        entity.ID(),
				UserID:    userID,
				ContentID: contentID,
			}
			if err := tx.Create(&fav).Error; err != nil {
				return fmt.Errorf("create favorite: %w", err)
			}
			if err := updateFavoriteCount(tx, contentID, 1); err != nil {
				return fmt.Errorf("update favorite count: %w", err)
			}
			resp.Favorited = true
		} else {
			return fmt.Errorf("check existing favorite: %w", err)
		}

		// Read back the updated favorite_count
		var count int64
		if err := tx.Model(&entity.Content{}).Where("id = ?", contentID).Pluck("favorite_count", &count).Error; err != nil {
			return fmt.Errorf("read favorite_count: %w", err)
		}
		resp.FavoriteCount = count
		return nil
	})
	if err != nil {
		log.Errorf("ToggleFavorite: %v", err)
		return nil, err
	}

	return &resp, nil
}

// IsFavorited checks whether a user has favorited a specific content.
func (s *Service) IsFavorited(ctx context.Context, userID, contentID string) (bool, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	err := s.db.WithContext(ctx).Model(&entity.Favorite{}).
		Where("user_id = ? AND content_id = ?", userID, contentID).
		Count(&count).Error
	if err != nil {
		log.Errorf("IsFavorited: %v", err)
		return false, fmt.Errorf("check is favorited: %w", err)
	}
	return count > 0, nil
}

func (s *Service) listFavoritesWithScope(ctx context.Context, userID string, pagination entity.Pagination, scope func(*gorm.DB) *gorm.DB) ([]entity.Content, string, error) {
	log := logger.NewWithContext(ctx)

	var contents []entity.Content
	query := applyContentListSelects(s.db.WithContext(ctx)).
		Joins("JOIN favorites ON favorites.content_id = contents.id").
		Where("favorites.user_id = ?", userID).
		Preload("Author").Preload("Speaker").
		Order("favorites.created_at DESC, favorites.id DESC")
	if scope != nil {
		query = scope(query)
	}

	if pagination.Cursor != "" {
		parts, err := entity.DecodeCursor(pagination.Cursor, 2)
		if err != nil {
			return nil, "", fmt.Errorf("decode cursor: %w", err)
		}
		cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return nil, "", fmt.Errorf("parse cursor created_at: %w", err)
		}
		cursorID := parts[1]
		query = query.Where("(favorites.created_at, favorites.id) < (?, ?)", cursorTime, cursorID)
	}

	if err := query.Limit(pagination.GetLimit()).Find(&contents).Error; err != nil {
		log.Errorf("ListFavorites: %v", err)
		return nil, "", fmt.Errorf("list favorites: %w", err)
	}

	// Build next_cursor
	var nextCursor string
	if len(contents) == pagination.GetLimit() {
		var lastFav entity.Favorite
		if err := s.db.WithContext(ctx).Where("user_id = ? AND content_id = ?", userID, contents[len(contents)-1].ID).First(&lastFav).Error; err == nil {
			nextCursor = entity.EncodeCursor(lastFav.CreatedAt.Format(time.RFC3339Nano), lastFav.ID)
		}
	}

	return contents, nextCursor, nil
}

// ListFavorites returns a paginated list of contents that the given user has favorited
// and can still access by detail link.
func (s *Service) ListFavorites(ctx context.Context, userID string, pagination entity.Pagination) ([]entity.Content, string, error) {
	return s.listFavoritesWithScope(ctx, userID, pagination, scopePublicDetailVisible)
}

// ListUserPublicFavorites returns the public-facing favorites shown on a user's profile page.
func (s *Service) ListUserPublicFavorites(ctx context.Context, userID string, pagination entity.Pagination) ([]entity.Content, string, error) {
	return s.listFavoritesWithScope(ctx, userID, pagination, scopePublicListVisible)
}

// updateFavoriteCount adjusts the favorite_count on the content's table.
func updateFavoriteCount(tx *gorm.DB, contentID string, delta int) error {
	expr := gorm.Expr("GREATEST(favorite_count + ?, 0)", delta)
	if err := tx.Model(&entity.Content{}).Where("id = ?", contentID).UpdateColumn("favorite_count", expr).Error; err != nil {
		return fmt.Errorf("update favorite_count: %w", err)
	}
	return nil
}
