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

// RecordContentView stores or updates a user's aggregated browsing record for a content item.
func (s *Service) RecordContentView(ctx context.Context, userID, contentID string) error {
	log := logger.NewWithContext(ctx)
	now := s.now()

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing entity.ContentView
		err := tx.Where("user_id = ? AND content_id = ?", userID, contentID).First(&existing).Error
		if err == nil {
			return tx.Model(&entity.ContentView{}).
				Where("id = ?", existing.ID).
				Updates(map[string]any{
					"last_viewed_at": now,
					"view_count":     gorm.Expr("view_count + ?", 1),
				}).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("find content view: %w", err)
		}

		record := entity.ContentView{
			ID:            entity.ID(),
			UserID:        userID,
			ContentID:     contentID,
			FirstViewedAt: now,
			LastViewedAt:  now,
			ViewCount:     1,
		}
		if err := tx.Create(&record).Error; err != nil {
			return fmt.Errorf("create content view: %w", err)
		}
		return nil
	})
	if err != nil {
		log.Errorf("RecordContentView: %v", err)
		return fmt.Errorf("record content view: %w", err)
	}

	return nil
}

// ListMyContentViews returns the current user's browsing history.
func (s *Service) ListMyContentViews(ctx context.Context, userID string, args entity.ListMyContentViewsArgs) ([]entity.MyContentViewItem, string, error) {
	log := logger.NewWithContext(ctx)

	query := s.db.WithContext(ctx).Model(&entity.ContentView{}).
		Joins("JOIN contents ON contents.id = content_views.content_id").
		Where("content_views.user_id = ?", userID).
		Where("contents.status = ?", entity.ContentStatusPublished).
		Order("content_views.last_viewed_at DESC, content_views.id DESC")

	if args.Type != "" {
		query = query.Where("contents.type = ?", args.Type)
	}
	if args.Cursor != "" {
		cursorTime, cursorID, err := parseContentViewCursor(args.Cursor)
		if err != nil {
			return nil, "", err
		}
		query = query.Where("(content_views.last_viewed_at, content_views.id) < (?, ?)", cursorTime, cursorID)
	}

	var records []entity.ContentView
	if err := query.Limit(args.GetLimit()).Find(&records).Error; err != nil {
		log.Errorf("ListMyContentViews: %v", err)
		return nil, "", fmt.Errorf("list my content views: %w", err)
	}

	items, err := s.buildMyContentViewItems(ctx, records)
	if err != nil {
		return nil, "", err
	}

	var nextCursor string
	if len(records) == args.GetLimit() {
		last := records[len(records)-1]
		nextCursor = encodeContentViewCursor(last.LastViewedAt, last.ID)
	}

	return items, nextCursor, nil
}

// ListContentViewUsers returns the browsing users for a content item.
func (s *Service) ListContentViewUsers(ctx context.Context, contentID string, pagination entity.Pagination) ([]entity.ContentViewUserItem, string, error) {
	log := logger.NewWithContext(ctx)

	query := s.db.WithContext(ctx).Model(&entity.ContentView{}).
		Where("content_id = ?", contentID).
		Preload("User").
		Order("last_viewed_at DESC, id DESC")

	if pagination.Cursor != "" {
		cursorTime, cursorID, err := parseContentViewCursor(pagination.Cursor)
		if err != nil {
			return nil, "", err
		}
		query = query.Where("(last_viewed_at, id) < (?, ?)", cursorTime, cursorID)
	}

	var records []entity.ContentView
	if err := query.Limit(pagination.GetLimit()).Find(&records).Error; err != nil {
		log.Errorf("ListContentViewUsers: %v", err)
		return nil, "", fmt.Errorf("list content view users: %w", err)
	}

	items := make([]entity.ContentViewUserItem, 0, len(records))
	for _, record := range records {
		if record.User == nil {
			continue
		}
		items = append(items, entity.ContentViewUserItem{
			User:          *record.User,
			FirstViewedAt: record.FirstViewedAt,
			LastViewedAt:  record.LastViewedAt,
			ViewCount:     record.ViewCount,
		})
	}

	var nextCursor string
	if len(records) == pagination.GetLimit() {
		last := records[len(records)-1]
		nextCursor = encodeContentViewCursor(last.LastViewedAt, last.ID)
	}

	return items, nextCursor, nil
}

func (s *Service) buildMyContentViewItems(ctx context.Context, records []entity.ContentView) ([]entity.MyContentViewItem, error) {
	if len(records) == 0 {
		return nil, nil
	}

	contentIDs := make([]string, 0, len(records))
	for _, record := range records {
		contentIDs = append(contentIDs, record.ContentID)
	}

	var contents []entity.Content
	if err := applyContentListSelects(s.db.WithContext(ctx).Model(&entity.Content{})).
		Where("contents.id IN ?", contentIDs).
		Preload("Author").
		Preload("Speaker").
		Find(&contents).Error; err != nil {
		return nil, fmt.Errorf("load contents for content views: %w", err)
	}

	contentMap := make(map[string]entity.Content, len(contents))
	for _, content := range contents {
		contentMap[content.ID] = content
	}

	items := make([]entity.MyContentViewItem, 0, len(records))
	for _, record := range records {
		content, ok := contentMap[record.ContentID]
		if !ok {
			continue
		}
		items = append(items, entity.MyContentViewItem{
			Content:       content,
			FirstViewedAt: record.FirstViewedAt,
			LastViewedAt:  record.LastViewedAt,
			ViewCount:     record.ViewCount,
		})
	}

	return items, nil
}

func encodeContentViewCursor(t time.Time, id string) string {
	return entity.EncodeCursor(t.Format(time.RFC3339Nano), id)
}

func parseContentViewCursor(cursor string) (time.Time, string, error) {
	parts, err := entity.DecodeCursor(cursor, 2)
	if err != nil {
		return time.Time{}, "", fmt.Errorf("decode cursor: %w", err)
	}
	cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("parse cursor last_viewed_at: %w", err)
	}
	return cursorTime, parts[1], nil
}
