package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// ListCommentsResponse represents the response for listing comments.
type ListCommentsResponse struct {
	Comments        []entity.Comment  `json:"comments"`
	Pagination      entity.Pagination `json:"pagination"`
	LikedCommentIDs []string          `json:"liked_comment_ids"`
}

// ListComments returns comments for a content item.
func (ctrl *Ctrl) ListComments(c *fox.Context, args entity.Pagination) (*ListCommentsResponse, error) {
	contentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	comments, total, err := ctrl.service.ListComments(contentID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	args.Total = total

	// Collect all comment IDs (top-level + replies) for liked check
	var allIDs []string
	for i := range comments {
		allIDs = append(allIDs, comments[i].ID)
		for j := range comments[i].Replies {
			allIDs = append(allIDs, comments[i].Replies[j].ID)
		}
	}

	likedIDs, _ := ctrl.service.GetLikedIDs(user.ID, allIDs, entity.TargetTypeComment)

	for i := range comments {
		comments[i].ResolveAssetURLs()
	}

	return &ListCommentsResponse{
		Comments:        comments,
		Pagination:      args,
		LikedCommentIDs: likedIDs,
	}, nil
}

// CreateComment creates a new comment on a content item.
func (ctrl *Ctrl) CreateComment(c *fox.Context, args entity.CreateCommentArgs) (*entity.Comment, error) {
	contentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Verify content exists
	content, err := ctrl.service.GetContentByID(contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	// If replying, validate parent comment exists and belongs to the same content
	if args.ParentID != "" {
		parent, err := ctrl.service.GetCommentByID(args.ParentID)
		if err != nil {
			return nil, httperrors.ErrInternalServerError
		}
		if parent == nil || parent.ContentID != contentID {
			return nil, httperrors.ErrInvalidArguments
		}
	}

	comment := &entity.Comment{
		ContentID: contentID,
		UserID:    user.ID,
		ParentID:  args.ParentID,
		ReplyToID: args.ReplyToID,
		Body:      args.Body,
	}

	if err := ctrl.service.CreateComment(comment); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Reload with user info
	comment.User = user
	comment.ResolveAssetURLs()
	return comment, nil
}

// LikeComment toggles like on a comment.
func (ctrl *Ctrl) LikeComment(c *fox.Context) (*entity.LikeResponse, error) {
	commentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	comment, err := ctrl.service.GetCommentByID(commentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if comment == nil {
		return nil, httperrors.ErrNotFound
	}

	resp, err := ctrl.service.ToggleLike(user.ID, commentID, entity.TargetTypeComment)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}
