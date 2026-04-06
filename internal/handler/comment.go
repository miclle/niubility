package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
)

// ListCommentsResponse represents the response for listing comments.
type ListCommentsResponse struct {
	Items           []entity.Comment `json:"items"`
	NextCursor      string           `json:"next_cursor,omitempty"`
	Total           int64            `json:"total"`
	LikedCommentIDs []string         `json:"liked_comment_ids"`
}

// ListCommentsQueryArgs represents query parameters for listing comments.
type ListCommentsQueryArgs struct {
	entity.Pagination
	ContentID    string `query:"content_id"`
	AttachmentID string `query:"attachment_id"`
}

// ListCommentsQuery returns comments using query parameters.
// GET /api/v1/comments?content_id=xxx
func (ctrl *Ctrl) ListCommentsQuery(c *fox.Context, args ListCommentsQueryArgs) (*ListCommentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	if args.ContentID == "" {
		return nil, httperrors.ErrInvalidArguments
	}

	comments, total, nextCursor, err := ctrl.service.ListComments(ctx, args.ContentID, args.AttachmentID, args.Pagination)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Collect all comment IDs (top-level + replies) for liked check
	var allIDs []string
	for i := range comments {
		allIDs = append(allIDs, comments[i].ID)
		for j := range comments[i].Replies {
			allIDs = append(allIDs, comments[i].Replies[j].ID)
		}
	}

	likedIDs, _ := ctrl.service.GetLikedIDs(ctx, user.ID, allIDs, entity.TargetTypeComment)

	for i := range comments {
		comments[i].ResolveAssetURLs()
	}

	return &ListCommentsResponse{
		Items:           comments,
		NextCursor:      nextCursor,
		Total:           total,
		LikedCommentIDs: likedIDs,
	}, nil
}

// CreateCommentBodyArgs represents the request body for creating a comment.
// POST /api/v1/comments
type CreateCommentBodyArgs struct {
	ContentID    string `json:"content_id" binding:"required"`
	AttachmentID string `json:"attachment_id"`
	ParentID     string `json:"parent_id"`
	ReplyToID    string `json:"reply_to_id"`
	Body         string `json:"body" binding:"required"`
}

// CreateCommentBody creates a new comment using body parameters.
func (ctrl *Ctrl) CreateCommentBody(c *fox.Context, args CreateCommentBodyArgs) (*entity.Comment, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Verify content exists
	content, err := ctrl.service.GetContentByID(ctx, args.ContentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	// If replying, validate parent comment exists and belongs to the same content
	if args.ParentID != "" {
		parent, err := ctrl.service.GetCommentByID(ctx, args.ParentID)
		if err != nil {
			return nil, httperrors.ErrInternalServerError
		}
		if parent == nil || parent.ContentID != args.ContentID {
			return nil, httperrors.ErrInvalidArguments
		}
	}

	comment := &entity.Comment{
		ContentID:    args.ContentID,
		AttachmentID: args.AttachmentID,
		UserID:       user.ID,
		ParentID:     args.ParentID,
		ReplyToID:    args.ReplyToID,
		Body:         args.Body,
	}

	if err := ctrl.service.CreateComment(ctx, comment); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Reload with user info
	comment.User = user
	comment.ResolveAssetURLs()
	return comment, nil
}

// DeleteComment deletes a comment. Users can delete their own comments; admins can delete any comment.
// DELETE /api/v1/comments/:id
func (ctrl *Ctrl) DeleteComment(c *fox.Context) (*struct{}, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	commentID := c.Param("id")

	// Verify comment exists and check permission
	comment, err := ctrl.service.GetCommentByID(ctx, commentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if comment == nil {
		return nil, httperrors.ErrNotFound
	}

	if comment.UserID != user.ID && !user.IsAdmin() {
		return nil, httperrors.ErrForbidden
	}

	if err := ctrl.service.DeleteComment(ctx, commentID); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return nil, nil
}

// ListMyCommentsResponse represents the response for listing the current user's comments.
type ListMyCommentsResponse struct {
	Items      []service.CommentWithContent `json:"items"`
	NextCursor string                       `json:"next_cursor,omitempty"`
	Total      int64                        `json:"total"`
}

// ListMyComments returns all comments made by the current user.
// GET /api/v1/comments/mine
func (ctrl *Ctrl) ListMyComments(c *fox.Context, args entity.Pagination) (*ListMyCommentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	comments, total, nextCursor, err := ctrl.service.ListMyComments(ctx, user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &ListMyCommentsResponse{
		Items:      comments,
		NextCursor: nextCursor,
		Total:      total,
	}, nil
}

// PinCommentRequest represents the request body for pinning a comment.
type PinCommentRequest struct {
	Pinned bool `json:"pinned"`
}

// PinComment pins or unpins a comment (admin only).
// POST /api/v1/admin/comments/:id/pin
func (ctrl *Ctrl) PinComment(c *fox.Context, args PinCommentRequest) (*entity.Comment, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	commentID := c.Param("id")

	comment, err := ctrl.service.PinComment(ctx, commentID, args.Pinned)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if comment == nil {
		return nil, httperrors.ErrNotFound
	}

	// Reload with user info
	comment, err = ctrl.service.GetCommentWithUser(ctx, commentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	comment.ResolveAssetURLs()
	return comment, nil
}
