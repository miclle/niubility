package service

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ListComments retrieves top-level comments for a content, with replies and user info preloaded.
func (s *Service) ListComments(contentID string, pagination entity.Pagination) ([]entity.Comment, int64, error) {
	var comments []entity.Comment
	var total int64

	query := s.DB.Model(&entity.Comment{}).Where("content_id = ? AND parent_id = ''", contentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count comments: %w", err)
	}

	err := query.
		Preload("User").
		Preload("Replies", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at ASC").Preload("User").Preload("ReplyTo.User")
		}).
		Offset(pagination.Offset()).Limit(pagination.GetLimit()).
		Order("created_at DESC").
		Find(&comments).Error
	if err != nil {
		return nil, 0, fmt.Errorf("list comments: %w", err)
	}

	return comments, total, nil
}

// CreateComment creates a new comment and updates the content's comment_count.
func (s *Service) CreateComment(comment *entity.Comment) error {
	comment.ID = entity.ID()

	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(comment).Error; err != nil {
			return fmt.Errorf("create comment: %w", err)
		}
		if err := tx.Model(&entity.Content{}).Where("id = ?", comment.ContentID).
			UpdateColumn("comment_count", gorm.Expr("comment_count + 1")).Error; err != nil {
			return fmt.Errorf("update content comment_count: %w", err)
		}
		return nil
	})
}

// GetCommentByID retrieves a single comment by ID.
func (s *Service) GetCommentByID(id string) (*entity.Comment, error) {
	var comment entity.Comment
	if err := s.DB.Where("id = ?", id).First(&comment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get comment by id: %w", err)
	}
	return &comment, nil
}
