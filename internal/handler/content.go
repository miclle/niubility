package handler

import (
	"net/http"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// ListContentsResponse represents the response for listing contents.
type ListContentsResponse struct {
	Items      []entity.Content `json:"items"`
	NextCursor string           `json:"next_cursor,omitempty"`
}

// ListContents returns a paginated list of contents with optional filters.
func (ctrl *Ctrl) ListContents(c *fox.Context, args entity.ListContentsArgs) (*ListContentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	contents, nextCursor, err := ctrl.service.ListContents(ctx, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range contents {
		contents[i].ResolveAssetURLs()
	}

	return &ListContentsResponse{
		Items:      contents,
		NextCursor: nextCursor,
	}, nil
}

// GetContentResponse represents the response for getting a single content.
type GetContentResponse struct {
	*entity.Content
	Liked              bool     `json:"liked"`
	Favorited          bool     `json:"favorited"`
	LikedAttachmentIDs []string `json:"liked_attachment_ids,omitempty"`
}

// GetContent returns a single content by ID, including the current user's liked status.
func (ctrl *Ctrl) GetContent(c *fox.Context) (*GetContentResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	id := c.Param("id")

	content, err := ctrl.service.GetContentByID(ctx, id)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	// Draft content is only visible to the author or admin
	if content.Status == entity.ContentStatusDraft {
		user := CurrentUser(c)
		if user == nil || (user.ID != content.AuthorID && !user.IsAdmin()) {
			return nil, httperrors.ErrNotFound
		}
	}

	content.ResolveAssetURLs()
	resp := &GetContentResponse{Content: content}

	if user := CurrentUser(c); user != nil {
		liked, _ := ctrl.service.IsLiked(ctx, user.ID, id, entity.TargetTypeContent)
		resp.Liked = liked

		favorited, _ := ctrl.service.IsFavorited(ctx, user.ID, id)
		resp.Favorited = favorited

		// Check which attachments are liked by the current user
		if len(content.Attachments) > 0 {
			attachmentIDs := make([]string, len(content.Attachments))
			for i, a := range content.Attachments {
				attachmentIDs[i] = a.ID
			}
			likedIDs, _ := ctrl.service.GetLikedIDs(ctx, user.ID, attachmentIDs, entity.TargetTypeAttachment)
			resp.LikedAttachmentIDs = likedIDs
		}
	}

	return resp, nil
}

// CreateContent creates a new content (authenticated users).
func (ctrl *Ctrl) CreateContent(c *fox.Context, args entity.CreateContentArgs) (*entity.Content, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	content := &entity.Content{
		AuthorID:    user.ID,
		Title:       args.Title,
		Summary:     args.Summary,
		Body:        args.Body,
		CoverURL:    args.CoverURL,
		Type:        args.Type,
		Status:      args.Status,
		Category:    args.Category,
		Tags:        args.Tags,
		SpeakerID:   args.SpeakerID,
		SpeakerName: args.SpeakerName,
		SpeakerBio:  args.SpeakerBio,
	}

	// Admin can override author for importing or content maintenance flows.
	if args.AuthorID != "" && user.IsAdmin() {
		content.AuthorID = args.AuthorID
	}

	// Admin can override creation time (e.g. for importing legacy content)
	if args.CreatedAt != nil && user.IsAdmin() {
		content.CreatedAt = *args.CreatedAt
	}
	if args.UpdatedAt != nil && user.IsAdmin() {
		content.UpdatedAt = *args.UpdatedAt
	} else if args.CreatedAt != nil && user.IsAdmin() {
		// If only CreatedAt is specified, use it for UpdatedAt as well
		content.UpdatedAt = *args.CreatedAt
	}

	if err := ctrl.service.CreateContent(ctx, content, args.Attachments); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	created, err := ctrl.service.GetContentByID(ctx, content.ID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	created.ResolveAssetURLs()
	return created, nil
}

// UpdateContent updates an existing content (author or admin).
func (ctrl *Ctrl) UpdateContent(c *fox.Context, args entity.UpdateContentArgs) (*entity.Content, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	id := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	existing, err := ctrl.service.GetContentByID(ctx, id)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if existing == nil {
		return nil, httperrors.ErrNotFound
	}
	if user.ID != existing.AuthorID && !user.IsAdmin() {
		return nil, httperrors.ErrForbidden
	}

	// Only admin can override timestamps
	if !user.IsAdmin() {
		args.AuthorID = nil
		args.CreatedAt = nil
		args.UpdatedAt = nil
	}

	content, err := ctrl.service.UpdateContent(ctx, id, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	content.ResolveAssetURLs()
	return content, nil
}

// DeleteContent deletes a content by ID (author or admin).
func (ctrl *Ctrl) DeleteContent(c *fox.Context) error {
	ctx := c.Logger.WithContext(c.Request.Context())
	id := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return httperrors.ErrUnauthorized
	}

	existing, err := ctrl.service.GetContentByID(ctx, id)
	if err != nil {
		return httperrors.ErrInternalServerError
	}
	if existing == nil {
		return httperrors.ErrNotFound
	}
	if user.ID != existing.AuthorID && !user.IsAdmin() {
		return httperrors.ErrForbidden
	}

	if err := ctrl.service.DeleteContent(ctx, id); err != nil {
		return httperrors.ErrInternalServerError
	}

	c.Status(http.StatusNoContent)
	return nil
}
