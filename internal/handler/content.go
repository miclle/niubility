package handler

import (
	"net/http"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// ListContentsResponse represents the response for listing contents.
type ListContentsResponse struct {
	Contents   []entity.Content  `json:"contents"`
	Pagination entity.Pagination `json:"pagination"`
}

// ListContents returns a paginated list of contents with optional filters.
func (ctrl *Ctrl) ListContents(c *fox.Context, args entity.ListContentsArgs) (*ListContentsResponse, error) {
	contents, total, err := ctrl.service.ListContents(args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	args.Total = total

	for i := range contents {
		contents[i].ResolveAssetURLs()
	}

	return &ListContentsResponse{
		Contents:   contents,
		Pagination: args.Pagination,
	}, nil
}

// GetContentResponse represents the response for getting a single content.
type GetContentResponse struct {
	*entity.Content
	Liked bool `json:"liked"`
}

// GetContent returns a single content by ID, including the current user's liked status.
func (ctrl *Ctrl) GetContent(c *fox.Context) (*GetContentResponse, error) {
	id := c.Param("id")

	content, err := ctrl.service.GetContentByID(id)
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
		liked, _ := ctrl.service.IsLiked(user.ID, id, entity.TargetTypeContent)
		resp.Liked = liked
	}

	return resp, nil
}

// LikeContent toggles like on a content item.
func (ctrl *Ctrl) LikeContent(c *fox.Context) (*entity.LikeResponse, error) {
	contentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	content, err := ctrl.service.GetContentByID(contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	resp, err := ctrl.service.ToggleLike(user.ID, contentID, entity.TargetTypeContent)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}

// CreateContent creates a new content (authenticated users).
func (ctrl *Ctrl) CreateContent(c *fox.Context, args entity.CreateContentArgs) (*entity.Content, error) {
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

	if err := ctrl.service.CreateContent(content, args.Attachments); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	created, err := ctrl.service.GetContentByID(content.ID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	created.ResolveAssetURLs()
	return created, nil
}

// UpdateContent updates an existing content (author or admin).
func (ctrl *Ctrl) UpdateContent(c *fox.Context, args entity.UpdateContentArgs) (*entity.Content, error) {
	id := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	existing, err := ctrl.service.GetContentByID(id)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if existing == nil {
		return nil, httperrors.ErrNotFound
	}
	if user.ID != existing.AuthorID && !user.IsAdmin() {
		return nil, httperrors.ErrForbidden
	}

	content, err := ctrl.service.UpdateContent(id, args)
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
	id := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return httperrors.ErrUnauthorized
	}

	existing, err := ctrl.service.GetContentByID(id)
	if err != nil {
		return httperrors.ErrInternalServerError
	}
	if existing == nil {
		return httperrors.ErrNotFound
	}
	if user.ID != existing.AuthorID && !user.IsAdmin() {
		return httperrors.ErrForbidden
	}

	if err := ctrl.service.DeleteContent(id); err != nil {
		return httperrors.ErrInternalServerError
	}

	c.Status(http.StatusNoContent)
	return nil
}

// ImportContents imports contents from the legacy platform (admin only).
func (ctrl *Ctrl) ImportContents(c *fox.Context, args entity.ImportContentsArgs) (*entity.ImportResult, error) {
	user := CurrentUser(c)
	result, err := ctrl.service.ImportContents(user.ID, args.Contents)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return result, nil
}
