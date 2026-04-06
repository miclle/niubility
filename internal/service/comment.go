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

// ListComments retrieves top-level comments for a content, with replies and user info preloaded.
// If attachmentID is non-empty, only comments for that attachment are returned.
func (s *Service) ListComments(ctx context.Context, contentID, attachmentID string, pagination entity.Pagination) ([]entity.Comment, int64, string, error) {
	log := logger.NewWithContext(ctx)

	var comments []entity.Comment
	var total int64

	query := s.db.WithContext(ctx).Model(&entity.Comment{}).Where("content_id = ? AND parent_id = ''", contentID)
	if attachmentID != "" {
		query = query.Where("attachment_id = ?", attachmentID)
	}

	if err := query.Count(&total).Error; err != nil {
		log.Errorf("ListComments: count: %v", err)
		return nil, 0, "", fmt.Errorf("count comments: %w", err)
	}

	fetchQuery := query.
		Preload("User").
		Preload("Replies", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC").Preload("User").Preload("ReplyTo.User")
		}).
		// Pinned comments first (by pinned_at DESC), then non-pinned (by created_at DESC)
		Order("CASE WHEN pinned_at IS NOT NULL THEN 0 ELSE 1 END").
		Order("pinned_at DESC, created_at DESC, id DESC")

	if pagination.Cursor != "" {
		parts, err := entity.DecodeCursor(pagination.Cursor, 2)
		if err != nil {
			return nil, 0, "", fmt.Errorf("decode cursor: %w", err)
		}
		cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return nil, 0, "", fmt.Errorf("parse cursor created_at: %w", err)
		}
		cursorID := parts[1]
		fetchQuery = fetchQuery.Where("(comments.created_at, comments.id) < (?, ?)", cursorTime, cursorID)
	}
	fetchQuery = fetchQuery.Limit(pagination.GetLimit())

	if err := fetchQuery.Find(&comments).Error; err != nil {
		log.Errorf("ListComments: find: %v", err)
		return nil, 0, "", fmt.Errorf("list comments: %w", err)
	}

	// Build next_cursor from the last item
	var nextCursor string
	if len(comments) == pagination.GetLimit() {
		last := comments[len(comments)-1]
		nextCursor = entity.EncodeCursor(last.CreatedAt.Format(time.RFC3339Nano), last.ID)
	}

	return comments, total, nextCursor, nil
}

// CreateComment creates a new comment and updates the content's comment_count.
func (s *Service) CreateComment(ctx context.Context, comment *entity.Comment) error {
	log := logger.NewWithContext(ctx)

	comment.ID = entity.ID()

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(comment).Error; err != nil {
			log.Errorf("CreateComment: %v", err)
			return fmt.Errorf("create comment: %w", err)
		}
		if err := tx.Model(&entity.Content{}).Where("id = ?", comment.ContentID).
			UpdateColumn("comment_count", gorm.Expr("comment_count + 1")).Error; err != nil {
			log.Errorf("CreateComment: update comment_count: %v", err)
			return fmt.Errorf("update content comment_count: %w", err)
		}
		return nil
	})
}

// GetCommentByID retrieves a single comment by ID.
func (s *Service) GetCommentByID(ctx context.Context, id string) (*entity.Comment, error) {
	log := logger.NewWithContext(ctx)

	var comment entity.Comment
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("GetCommentByID: %v", err)
		return nil, fmt.Errorf("get comment by id: %w", err)
	}
	return &comment, nil
}

// GetCommentWithUser retrieves a single comment by ID with user info preloaded.
func (s *Service) GetCommentWithUser(ctx context.Context, id string) (*entity.Comment, error) {
	log := logger.NewWithContext(ctx)

	var comment entity.Comment
	if err := s.db.WithContext(ctx).Preload("User").Where("id = ?", id).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("GetCommentWithUser: %v", err)
		return nil, fmt.Errorf("get comment with user: %w", err)
	}
	return &comment, nil
}

// DeleteComment deletes a comment (and its replies) by ID, decrements the content's comment_count,
// and removes associated likes.
func (s *Service) DeleteComment(ctx context.Context, id string) error {
	log := logger.NewWithContext(ctx)

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Count the comment itself + its replies for total decrement
		var totalCount int64
		if err := tx.Model(&entity.Comment{}).
			Where("id = ? OR parent_id = ?", id, id).
			Count(&totalCount).Error; err != nil {
			log.Errorf("DeleteComment: count comments: %v", err)
			return fmt.Errorf("count comments to delete: %w", err)
		}

		// Collect all comment IDs (the comment + replies) to delete associated likes
		var commentIDs []string
		if err := tx.Model(&entity.Comment{}).
			Where("id = ? OR parent_id = ?", id, id).
			Pluck("id", &commentIDs).Error; err != nil {
			log.Errorf("DeleteComment: pluck comment ids: %v", err)
			return fmt.Errorf("pluck comment ids: %w", err)
		}

		// Get the content_id before deleting to update comment_count
		var contentID string
		if err := tx.Model(&entity.Comment{}).Where("id = ?", id).Pluck("content_id", &contentID).Error; err != nil {
			log.Errorf("DeleteComment: get content_id: %v", err)
			return fmt.Errorf("get content_id: %w", err)
		}

		// Delete associated likes for all comments being removed
		if err := tx.Where("target_id IN ? AND target_type = ?", commentIDs, entity.TargetTypeComment).
			Delete(&entity.Like{}).Error; err != nil {
			log.Errorf("DeleteComment: delete likes: %v", err)
			return fmt.Errorf("delete comment likes: %w", err)
		}

		// Delete replies first, then the parent comment
		if err := tx.Where("parent_id = ?", id).Delete(&entity.Comment{}).Error; err != nil {
			log.Errorf("DeleteComment: delete replies: %v", err)
			return fmt.Errorf("delete comment replies: %w", err)
		}

		if err := tx.Where("id = ?", id).Delete(&entity.Comment{}).Error; err != nil {
			log.Errorf("DeleteComment: delete comment: %v", err)
			return fmt.Errorf("delete comment: %w", err)
		}

		// Decrement content comment_count
		if err := tx.Model(&entity.Content{}).Where("id = ?", contentID).
			UpdateColumn("comment_count", gorm.Expr("GREATEST(comment_count - ?, 0)", totalCount)).Error; err != nil {
			log.Errorf("DeleteComment: update comment_count: %v", err)
			return fmt.Errorf("update content comment_count: %w", err)
		}

		return nil
	})
}

// CommentWithContent holds a comment enriched with its associated content for "my comments" listings.
type CommentWithContent struct {
	entity.Comment
	Content *entity.Content `json:"content,omitempty" gorm:"foreignKey:ContentID"`
}

// ListMyComments retrieves all comments (top-level and replies) by a given user, enriched with content info,
// ordered by creation date descending.
func (s *Service) ListMyComments(ctx context.Context, userID string, pagination entity.Pagination) ([]CommentWithContent, int64, string, error) {
	log := logger.NewWithContext(ctx)

	var total int64
	if err := s.db.WithContext(ctx).Model(&entity.Comment{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		log.Errorf("ListMyComments: count: %v", err)
		return nil, 0, "", fmt.Errorf("count my comments: %w", err)
	}

	query := s.db.WithContext(ctx).
		Model(&entity.Comment{}).
		Where("user_id = ?", userID).
		Preload("User").
		Preload("Content")

	if pagination.Cursor != "" {
		parts, err := entity.DecodeCursor(pagination.Cursor, 2)
		if err != nil {
			return nil, 0, "", fmt.Errorf("decode cursor: %w", err)
		}
		cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return nil, 0, "", fmt.Errorf("parse cursor created_at: %w", err)
		}
		cursorID := parts[1]
		query = query.Where("(comments.created_at, comments.id) < (?, ?)", cursorTime, cursorID)
	}

	var comments []CommentWithContent
	findQuery := query.Order("comments.created_at DESC, comments.id DESC").Limit(pagination.GetLimit())
	if err := findQuery.Find(&comments).Error; err != nil {
		log.Errorf("ListMyComments: find: %v", err)
		return nil, 0, "", fmt.Errorf("list my comments: %w", err)
	}

	for i := range comments {
		comments[i].ResolveAssetURLs()
	}

	var nextCursor string
	if len(comments) == pagination.GetLimit() {
		last := comments[len(comments)-1]
		nextCursor = entity.EncodeCursor(last.CreatedAt.Format(time.RFC3339Nano), last.ID)
	}

	return comments, total, nextCursor, nil
}

// PinComment pins or unpins a comment. Only top-level comments can be pinned.
func (s *Service) PinComment(ctx context.Context, id string, pinned bool) (*entity.Comment, error) {
	log := logger.NewWithContext(ctx)

	var comment entity.Comment
	if err := s.db.WithContext(ctx).Where("id = ? AND parent_id = ''", id).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("PinComment: find comment: %v", err)
		return nil, fmt.Errorf("find comment: %w", err)
	}

	var pinnedAt *time.Time
	if pinned {
		now := time.Now()
		pinnedAt = &now
	}

	if err := s.db.WithContext(ctx).Model(&entity.Comment{}).Where("id = ?", id).
		Update("pinned_at", pinnedAt).Error; err != nil {
		log.Errorf("PinComment: update: %v", err)
		return nil, fmt.Errorf("update comment pin status: %w", err)
	}

	comment.PinnedAt = pinnedAt
	return &comment, nil
}
