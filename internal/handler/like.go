package handler

import (
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
)

// ToggleLikeArgs represents the request body for toggling like on any target.
type ToggleLikeArgs struct {
	// TargetType is the type of target: "content", "comment", or "attachment"
	TargetType string `json:"target_type" binding:"required,oneof=content comment attachment"`
	// TargetID is the ID of the target
	TargetID string `json:"target_id" binding:"required"`
}

// ToggleLike toggles like on any target (content, comment, or attachment).
// POST /api/v1/likes
func (ctrl *Ctrl) ToggleLike(c *fox.Context, args ToggleLikeArgs) (*entity.LikeResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Map target type string to entity type
	var targetType entity.TargetType
	switch args.TargetType {
	case "content":
		targetType = entity.TargetTypeContent
		content, err := ctrl.service.GetContentByID(ctx, args.TargetID)
		if err != nil {
			return nil, httperrors.ErrInternalServerError
		}
		if content == nil {
			return nil, httperrors.ErrNotFound
		}
	case "comment":
		targetType = entity.TargetTypeComment
		comment, err := ctrl.service.GetCommentByID(ctx, args.TargetID)
		if err != nil {
			return nil, httperrors.ErrInternalServerError
		}
		if comment == nil {
			return nil, httperrors.ErrNotFound
		}
	case "attachment":
		targetType = entity.TargetTypeAttachment
		// Attachment validation is handled in service layer
	default:
		return nil, httperrors.ErrInvalidArguments
	}

	resp, err := ctrl.service.ToggleLike(ctx, user.ID, args.TargetID, targetType)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}

// MyLikesItem represents a single grouped entry in the current user's liked content list.
type MyLikesItem struct {
	Content              entity.Content    `json:"content"`
	LastLikedAt          string            `json:"last_liked_at"`
	LikedContent         bool              `json:"liked_content"`
	LikedCommentCount    int64             `json:"liked_comment_count"`
	LikedAttachmentCount int64             `json:"liked_attachment_count"`
	RecentTargetType     entity.TargetType `json:"recent_target_type"`
	RecentTargetID       string            `json:"recent_target_id"`
	RecentAttachmentID   string            `json:"recent_attachment_id"`
}

// ListMyLikesResponse represents the response for listing the current user's likes grouped by content.
type ListMyLikesResponse struct {
	Items      []MyLikesItem `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	Total      int64         `json:"total"`
}

func buildMyLikesItems(items []service.MyLikeContentSummary) []MyLikesItem {
	resp := make([]MyLikesItem, 0, len(items))
	for i := range items {
		content := items[i].Content
		content.ResolveAssetURLs()
		resp = append(resp, MyLikesItem{
			Content:              content,
			LastLikedAt:          items[i].LastLikedAt.Format(time.RFC3339Nano),
			LikedContent:         items[i].LikedContent,
			LikedCommentCount:    items[i].LikedCommentCount,
			LikedAttachmentCount: items[i].LikedAttachmentCount,
			RecentTargetType:     items[i].RecentTargetType,
			RecentTargetID:       items[i].RecentTargetID,
			RecentAttachmentID:   items[i].RecentAttachmentID,
		})
	}
	return resp
}

// ListMyLikes returns the current user's likes grouped by content.
// GET /api/v1/likes/mine
func (ctrl *Ctrl) ListMyLikes(c *fox.Context, args entity.Pagination) (*ListMyLikesResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	items, total, nextCursor, err := ctrl.service.ListMyLikesGroupedByContent(ctx, user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &ListMyLikesResponse{
		Items:      buildMyLikesItems(items),
		NextCursor: nextCursor,
		Total:      total,
	}, nil
}
