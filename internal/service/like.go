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

type myLikeContentRow struct {
	ContentID            string
	LastLikedAt          string
	LikedContent         int64
	LikedCommentCount    int64
	LikedAttachmentCount int64
	RecentTargetType     entity.TargetType
	RecentTargetID       string
	RecentAttachmentID   string
}

func myLikeInteractionsSQL() string {
	return `
SELECT
	likes.id AS like_id,
	likes.created_at AS liked_at,
	likes.target_type AS target_type,
	likes.target_id AS target_id,
	contents.id AS content_id,
	'' AS attachment_id
FROM likes
JOIN contents ON contents.id = likes.target_id
WHERE likes.user_id = ? AND likes.target_type = ? AND contents.status = ?
UNION ALL
SELECT
	likes.id AS like_id,
	likes.created_at AS liked_at,
	likes.target_type AS target_type,
	likes.target_id AS target_id,
	contents.id AS content_id,
	comments.attachment_id AS attachment_id
FROM likes
JOIN comments ON comments.id = likes.target_id
JOIN contents ON contents.id = comments.content_id
WHERE likes.user_id = ? AND likes.target_type = ? AND contents.status = ?
UNION ALL
SELECT
	likes.id AS like_id,
	likes.created_at AS liked_at,
	likes.target_type AS target_type,
	likes.target_id AS target_id,
	contents.id AS content_id,
	attachments.id AS attachment_id
FROM likes
JOIN attachments ON attachments.id = likes.target_id
JOIN contents ON contents.id = attachments.content_id
WHERE likes.user_id = ? AND likes.target_type = ? AND contents.status = ?
`
}

func myLikeInteractionsArgs(userID string) []any {
	return []any{
		userID, entity.TargetTypeContent, entity.ContentStatusPublished,
		userID, entity.TargetTypeComment, entity.ContentStatusPublished,
		userID, entity.TargetTypeAttachment, entity.ContentStatusPublished,
	}
}

func parseLikedAt(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339Nano,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05-07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported liked_at format: %s", value)
}

// ListMyLikesGroupedByContent returns a paginated list of the current user's likes grouped by content.
func (s *Service) ListMyLikesGroupedByContent(ctx context.Context, userID string, pagination entity.Pagination) ([]MyLikeContentSummary, int64, string, error) {
	log := logger.NewWithContext(ctx)

	interactionsSQL := myLikeInteractionsSQL()
	interactionArgs := myLikeInteractionsArgs(userID)

	countSQL := fmt.Sprintf(`
SELECT COUNT(*) AS total
FROM (
	SELECT DISTINCT content_id
	FROM (%s) interactions
) grouped
`, interactionsSQL)

	var total int64
	if err := s.db.WithContext(ctx).Raw(countSQL, interactionArgs...).Scan(&total).Error; err != nil {
		log.Errorf("ListMyLikesGroupedByContent: count: %v", err)
		return nil, 0, "", fmt.Errorf("count my likes grouped by content: %w", err)
	}

	listSQL := fmt.Sprintf(`
WITH interactions AS (
	%s
),
ranked AS (
	SELECT
		content_id,
		target_type,
		target_id,
		attachment_id,
		liked_at,
		like_id,
		ROW_NUMBER() OVER (PARTITION BY content_id ORDER BY liked_at DESC, like_id DESC) AS rn
	FROM interactions
),
grouped AS (
	SELECT
		content_id,
		MAX(liked_at) AS last_liked_at,
		MAX(CASE WHEN target_type = 'content' THEN 1 ELSE 0 END) AS liked_content,
		SUM(CASE WHEN target_type = 'comment' THEN 1 ELSE 0 END) AS liked_comment_count,
		SUM(CASE WHEN target_type = 'attachment' THEN 1 ELSE 0 END) AS liked_attachment_count
	FROM interactions
	GROUP BY content_id
)
SELECT
	grouped.content_id,
	grouped.last_liked_at,
	grouped.liked_content,
	grouped.liked_comment_count,
	grouped.liked_attachment_count,
	ranked.target_type AS recent_target_type,
	ranked.target_id AS recent_target_id,
	ranked.attachment_id AS recent_attachment_id
FROM grouped
JOIN ranked ON ranked.content_id = grouped.content_id AND ranked.rn = 1
`, interactionsSQL)

	args := append([]any{}, interactionArgs...)
	if pagination.Cursor != "" {
		parts, err := entity.DecodeCursor(pagination.Cursor, 2)
		if err != nil {
			return nil, 0, "", fmt.Errorf("decode cursor: %w", err)
		}
		cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return nil, 0, "", fmt.Errorf("parse cursor last_liked_at: %w", err)
		}
		cursorContentID := parts[1]
		listSQL += " WHERE (grouped.last_liked_at < ?) OR (grouped.last_liked_at = ? AND grouped.content_id < ?)"
		args = append(args, cursorTime, cursorTime, cursorContentID)
	}
	listSQL += " ORDER BY grouped.last_liked_at DESC, grouped.content_id DESC LIMIT ?"
	args = append(args, pagination.GetLimit())

	var rows []myLikeContentRow
	if err := s.db.WithContext(ctx).Raw(listSQL, args...).Scan(&rows).Error; err != nil {
		log.Errorf("ListMyLikesGroupedByContent: list: %v", err)
		return nil, 0, "", fmt.Errorf("list my likes grouped by content: %w", err)
	}
	if len(rows) == 0 {
		return []MyLikeContentSummary{}, total, "", nil
	}

	contentIDs := make([]string, 0, len(rows))
	for _, row := range rows {
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

	items := make([]MyLikeContentSummary, 0, len(rows))
	for _, row := range rows {
		content, ok := contentMap[row.ContentID]
		if !ok {
			continue
		}
		lastLikedAt, err := parseLikedAt(row.LastLikedAt)
		if err != nil {
			return nil, 0, "", fmt.Errorf("parse last_liked_at: %w", err)
		}
		items = append(items, MyLikeContentSummary{
			Content:              content,
			LastLikedAt:          lastLikedAt,
			LikedContent:         row.LikedContent > 0,
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
