package service

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ToggleLike toggles a like for a user on a target (content or comment).
// Returns the new liked state and updated like count.
func (s *Service) ToggleLike(ctx context.Context, userID, targetID string, targetType entity.TargetType) (*entity.LikeResponse, error) {
	log := logger.NewWithContext(ctx)

	var resp entity.LikeResponse

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing entity.Like
		err := tx.Where("user_id = ? AND target_id = ? AND target_type = ?", userID, targetID, targetType).
			First(&existing).Error

		if err == nil {
			// Already liked — unlike
			if err := tx.Delete(&existing).Error; err != nil {
				return fmt.Errorf("delete like: %w", err)
			}
			if err := updateLikeCount(tx, targetID, targetType, -1); err != nil {
				return fmt.Errorf("update like count: %w", err)
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
				return fmt.Errorf("update like count: %w", err)
			}
			resp.Liked = true
		} else {
			return fmt.Errorf("check existing like: %w", err)
		}

		// Read back the updated like_count
		count, err := getLikeCount(tx, targetID, targetType)
		if err != nil {
			return fmt.Errorf("get like count: %w", err)
		}
		resp.LikeCount = count
		return nil
	})
	if err != nil {
		log.Errorf("ToggleLike: %v", err)
		return nil, err
	}

	return &resp, nil
}

// IsLiked checks whether a user has liked a specific target.
func (s *Service) IsLiked(ctx context.Context, userID, targetID string, targetType entity.TargetType) (bool, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	err := s.db.WithContext(ctx).Model(&entity.Like{}).
		Where("user_id = ? AND target_id = ? AND target_type = ?", userID, targetID, targetType).
		Count(&count).Error
	if err != nil {
		log.Errorf("IsLiked: %v", err)
		return false, fmt.Errorf("check is liked: %w", err)
	}
	return count > 0, nil
}

// GetLikedIDs returns the subset of targetIDs that the user has liked.
func (s *Service) GetLikedIDs(ctx context.Context, userID string, targetIDs []string, targetType entity.TargetType) ([]string, error) {
	log := logger.NewWithContext(ctx)

	if len(targetIDs) == 0 {
		return nil, nil
	}
	var ids []string
	err := s.db.WithContext(ctx).Model(&entity.Like{}).
		Where("user_id = ? AND target_id IN ? AND target_type = ?", userID, targetIDs, targetType).
		Pluck("target_id", &ids).Error
	if err != nil {
		log.Errorf("GetLikedIDs: %v", err)
		return nil, fmt.Errorf("get liked ids: %w", err)
	}
	return ids, nil
}

// MyLikeContentSummary represents a user's like activity grouped by content.
type MyLikeContentSummary struct {
	Content              entity.Content    `json:"content"`
	LastLikedAt          time.Time         `json:"last_liked_at"`
	LikedContent         bool              `json:"liked_content"`
	LikedCommentCount    int64             `json:"liked_comment_count"`
	LikedAttachmentCount int64             `json:"liked_attachment_count"`
	RecentTargetType     entity.TargetType `json:"recent_target_type"`
	RecentTargetID       string            `json:"recent_target_id"`
	RecentAttachmentID   string            `json:"recent_attachment_id"`
}

type myLikeInteraction struct {
	LikeID       string
	LikedAt      time.Time
	TargetType   entity.TargetType
	TargetID     string
	ContentID    string
	AttachmentID string
}

type myLikeContentAggregate struct {
	ContentID            string
	LastLikedAt          time.Time
	LastLikeID           string
	LikedContent         bool
	LikedCommentCount    int64
	LikedAttachmentCount int64
	RecentTargetType     entity.TargetType
	RecentTargetID       string
	RecentAttachmentID   string
}

type myLikeRow struct {
	LikeID       string    `gorm:"column:like_id"`
	LikedAt      time.Time `gorm:"column:liked_at"`
	TargetID     string    `gorm:"column:target_id"`
	ContentID    string    `gorm:"column:content_id"`
	AttachmentID string    `gorm:"column:attachment_id"`
}

// myLikeQuerySpec defines the SQL shape for loading likes of a specific target type.
type myLikeQuerySpec struct {
	targetType entity.TargetType
	selectCols string
	joins      []string
}

// myLikeQuerySpecs maps each target type to its query shape.
var myLikeQuerySpecs = []myLikeQuerySpec{
	{
		targetType: entity.TargetTypeContent,
		selectCols: "likes.id AS like_id, likes.created_at AS liked_at, likes.target_id AS target_id, contents.id AS content_id, '' AS attachment_id",
		joins:      []string{"JOIN contents ON contents.id = likes.target_id"},
	},
	{
		targetType: entity.TargetTypeComment,
		selectCols: "likes.id AS like_id, likes.created_at AS liked_at, likes.target_id AS target_id, comments.content_id AS content_id, comments.attachment_id AS attachment_id",
		joins:      []string{"JOIN comments ON comments.id = likes.target_id", "JOIN contents ON contents.id = comments.content_id"},
	},
	{
		targetType: entity.TargetTypeAttachment,
		selectCols: "likes.id AS like_id, likes.created_at AS liked_at, likes.target_id AS target_id, attachments.content_id AS content_id, attachments.id AS attachment_id",
		joins:      []string{"JOIN attachments ON attachments.id = likes.target_id", "JOIN contents ON contents.id = attachments.content_id"},
	},
}

func loadMyLikeInteractionsByType(ctx context.Context, db *gorm.DB, userID string, spec myLikeQuerySpec) ([]myLikeInteraction, error) {
	var rows []myLikeRow
	q := db.WithContext(ctx).Model(&entity.Like{}).
		Select(spec.selectCols).
		Where("likes.user_id = ? AND likes.target_type = ?", userID, spec.targetType).
		Where("contents.status = ?", entity.ContentStatusPublished)
	for _, join := range spec.joins {
		q = q.Joins(join)
	}
	if err := q.Scan(&rows).Error; err != nil {
		return nil, err
	}
	items := make([]myLikeInteraction, 0, len(rows))
	for _, row := range rows {
		items = append(items, myLikeInteraction{
			LikeID: row.LikeID, LikedAt: row.LikedAt,
			TargetType: spec.targetType, TargetID: row.TargetID,
			ContentID: row.ContentID, AttachmentID: row.AttachmentID,
		})
	}
	return items, nil
}

func loadMyLikeInteractions(ctx context.Context, db *gorm.DB, userID string) ([]myLikeInteraction, error) {
	var items []myLikeInteraction
	for _, spec := range myLikeQuerySpecs {
		result, err := loadMyLikeInteractionsByType(ctx, db, userID, spec)
		if err != nil {
			return nil, fmt.Errorf("load %s likes: %w", spec.targetType, err)
		}
		items = append(items, result...)
	}
	return items, nil
}

func aggregateMyLikesByContent(interactions []myLikeInteraction) []myLikeContentAggregate {
	grouped := make(map[string]*myLikeContentAggregate, len(interactions))
	for _, interaction := range interactions {
		entry, ok := grouped[interaction.ContentID]
		if !ok {
			entry = &myLikeContentAggregate{ContentID: interaction.ContentID}
			grouped[interaction.ContentID] = entry
		}

		if interaction.LikedAt.After(entry.LastLikedAt) || (interaction.LikedAt.Equal(entry.LastLikedAt) && interaction.LikeID > entry.LastLikeID) {
			entry.LastLikedAt = interaction.LikedAt
			entry.LastLikeID = interaction.LikeID
			entry.RecentTargetType = interaction.TargetType
			entry.RecentTargetID = interaction.TargetID
			entry.RecentAttachmentID = interaction.AttachmentID
		}

		switch interaction.TargetType {
		case entity.TargetTypeContent:
			entry.LikedContent = true
		case entity.TargetTypeComment:
			entry.LikedCommentCount++
		case entity.TargetTypeAttachment:
			entry.LikedAttachmentCount++
		}
	}

	items := make([]myLikeContentAggregate, 0, len(grouped))
	for _, item := range grouped {
		items = append(items, *item)
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].LastLikedAt.Equal(items[j].LastLikedAt) {
			return items[i].ContentID > items[j].ContentID
		}
		return items[i].LastLikedAt.After(items[j].LastLikedAt)
	})

	return items
}

func filterMyLikeAggregatesByCursor(items []myLikeContentAggregate, cursor string) ([]myLikeContentAggregate, error) {
	if cursor == "" {
		return items, nil
	}

	parts, err := entity.DecodeCursor(cursor, 2)
	if err != nil {
		return nil, fmt.Errorf("decode cursor: %w", err)
	}
	cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return nil, fmt.Errorf("parse cursor last_liked_at: %w", err)
	}
	cursorContentID := parts[1]

	filtered := make([]myLikeContentAggregate, 0, len(items))
	for _, item := range items {
		if item.LastLikedAt.Before(cursorTime) || (item.LastLikedAt.Equal(cursorTime) && item.ContentID < cursorContentID) {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

// ListMyLikesGroupedByContent returns a paginated list of the current user's likes grouped by content.
func (s *Service) ListMyLikesGroupedByContent(ctx context.Context, userID string, pagination entity.Pagination) ([]MyLikeContentSummary, int64, string, error) {
	log := logger.NewWithContext(ctx)

	interactions, err := loadMyLikeInteractions(ctx, s.db, userID)
	if err != nil {
		log.Errorf("ListMyLikesGroupedByContent: interactions: %v", err)
		return nil, 0, "", fmt.Errorf("load my likes grouped by content: %w", err)
	}

	aggregates := aggregateMyLikesByContent(interactions)
	total := int64(len(aggregates))

	aggregates, err = filterMyLikeAggregatesByCursor(aggregates, pagination.Cursor)
	if err != nil {
		return nil, 0, "", err
	}
	if len(aggregates) == 0 {
		return []MyLikeContentSummary{}, total, "", nil
	}

	if len(aggregates) > pagination.GetLimit() {
		aggregates = aggregates[:pagination.GetLimit()]
	}

	contentIDs := make([]string, 0, len(aggregates))
	for _, row := range aggregates {
		contentIDs = append(contentIDs, row.ContentID)
	}

	var contents []entity.Content
	if err := applyContentListSelects(s.db.WithContext(ctx).Model(&entity.Content{})).
		Where("contents.id IN ?", contentIDs).
		Preload("Author").
		Preload("Speaker").
		Find(&contents).Error; err != nil {
		log.Errorf("ListMyLikesGroupedByContent: load contents: %v", err)
		return nil, 0, "", fmt.Errorf("load liked contents: %w", err)
	}

	contentMap := make(map[string]entity.Content, len(contents))
	for _, content := range contents {
		contentMap[content.ID] = content
	}

	items := make([]MyLikeContentSummary, 0, len(aggregates))
	for _, row := range aggregates {
		content, ok := contentMap[row.ContentID]
		if !ok {
			continue
		}
		items = append(items, MyLikeContentSummary{
			Content:              content,
			LastLikedAt:          row.LastLikedAt,
			LikedContent:         row.LikedContent,
			LikedCommentCount:    row.LikedCommentCount,
			LikedAttachmentCount: row.LikedAttachmentCount,
			RecentTargetType:     row.RecentTargetType,
			RecentTargetID:       row.RecentTargetID,
			RecentAttachmentID:   row.RecentAttachmentID,
		})
	}

	var nextCursor string
	if len(items) == pagination.GetLimit() {
		last := items[len(items)-1]
		nextCursor = entity.EncodeCursor(last.LastLikedAt.Format(time.RFC3339Nano), last.Content.ID)
	}

	return items, total, nextCursor, nil
}

// updateLikeCount adjusts the like_count on the target's table.
func updateLikeCount(tx *gorm.DB, targetID string, targetType entity.TargetType, delta int) error {
	var model any
	switch targetType {
	case entity.TargetTypeContent:
		model = &entity.Content{}
	case entity.TargetTypeComment:
		model = &entity.Comment{}
	case entity.TargetTypeAttachment:
		model = &entity.Attachment{}
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
	case entity.TargetTypeAttachment:
		err := tx.Model(&entity.Attachment{}).Where("id = ?", targetID).Pluck("like_count", &count).Error
		return count, err
	default:
		return 0, fmt.Errorf("unknown target type: %s", targetType)
	}
}
