package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
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

// ListComments returns comments for a content item (legacy endpoint).
// GET /api/v1/contents/:id/comments
func (ctrl *Ctrl) ListComments(c *fox.Context, args entity.Pagination) (*ListCommentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	contentID := c.Param("id")
	attachmentID := c.Query("attachment_id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	comments, total, nextCursor, err := ctrl.service.ListComments(ctx, contentID, attachmentID, args)
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

// ListCommentsQuery returns comments using query parameters (new unified endpoint).
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

// CreateComment creates a new comment on a content item (legacy endpoint).
// POST /api/v1/contents/:id/comments
func (ctrl *Ctrl) CreateComment(c *fox.Context, args entity.CreateCommentArgs) (*entity.Comment, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	contentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Verify content exists
	content, err := ctrl.service.GetContentByID(ctx, contentID)
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
		if parent == nil || parent.ContentID != contentID {
			return nil, httperrors.ErrInvalidArguments
		}
	}

	comment := &entity.Comment{
		ContentID:    contentID,
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

// CreateCommentBody creates a new comment using body parameters (new unified endpoint).
// POST /api/v1/comments
type CreateCommentBodyArgs struct {
	ContentID    string `json:"content_id" binding:"required"`
	AttachmentID string `json:"attachment_id"`
	ParentID     string `json:"parent_id"`
	ReplyToID    string `json:"reply_to_id"`
	Body         string `json:"body" binding:"required"`
}

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

// LikeComment toggles like on a comment.
func (ctrl *Ctrl) LikeComment(c *fox.Context) (*entity.LikeResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	commentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	comment, err := ctrl.service.GetCommentByID(ctx, commentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if comment == nil {
		return nil, httperrors.ErrNotFound
	}

	resp, err := ctrl.service.ToggleLike(ctx, user.ID, commentID, entity.TargetTypeComment)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}
