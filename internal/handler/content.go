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

	return &ListContentsResponse{
		Contents:   contents,
		Pagination: args.Pagination,
	}, nil
}

// GetContent returns a single content by ID.
func (ctrl *Ctrl) GetContent(c *fox.Context) (*entity.Content, error) {
	id := c.Param("id")

	content, err := ctrl.service.GetContentByID(id)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	return content, nil
}

// CreateContent creates a new content (admin only).
func (ctrl *Ctrl) CreateContent(c *fox.Context, args entity.CreateContentArgs) (*entity.Content, error) {
	user := CurrentUser(c)

	content := &entity.Content{
		AuthorID:   user.ID,
		Title:      args.Title,
		Summary:    args.Summary,
		Body:       args.Body,
		CoverURL:   args.CoverURL,
		VideoURL:   args.VideoURL,
		Type:       args.Type,
		Category:   args.Category,
		Tags:       args.Tags,
		Speaker:    args.Speaker,
		SpeakerBio: args.SpeakerBio,
	}

	if err := ctrl.service.CreateContent(content); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// reload with author
	return ctrl.service.GetContentByID(content.ID)
}

// UpdateContent updates an existing content (admin only).
func (ctrl *Ctrl) UpdateContent(c *fox.Context, args entity.UpdateContentArgs) (*entity.Content, error) {
	id := c.Param("id")

	content, err := ctrl.service.UpdateContent(id, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	return content, nil
}

// DeleteContent deletes a content by ID (admin only).
func (ctrl *Ctrl) DeleteContent(c *fox.Context) error {
	id := c.Param("id")

	existing, err := ctrl.service.GetContentByID(id)
	if err != nil {
		return httperrors.ErrInternalServerError
	}
	if existing == nil {
		return httperrors.ErrNotFound
	}

	if err := ctrl.service.DeleteContent(id); err != nil {
		return httperrors.ErrInternalServerError
	}

	c.Status(http.StatusNoContent)
	return nil
}

// ImportContents imports contents from the legacy platform (admin only).
func (ctrl *Ctrl) ImportContents(c *fox.Context, args entity.ImportContentsArgs) (*entity.ImportResult, error) {
	result, err := ctrl.service.ImportContents(args.Category, args.Contents)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return result, nil
}
