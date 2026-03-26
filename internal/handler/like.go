package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
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
