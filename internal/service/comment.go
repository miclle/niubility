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
