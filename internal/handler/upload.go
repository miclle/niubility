package handler

import (
	"net/http"
	"strings"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
)

// PresignRequest represents the request body for generating a presigned upload URL.
type PresignRequest struct {
	Filename    string `json:"filename" binding:"required"`
	ContentType string `json:"content_type" binding:"required"`
	Category    string `json:"category" binding:"required"` // covers | videos | images
}

// PresignResponse represents the presigned URL response.
type PresignResponse struct {
	PresignedURL string `json:"presigned_url"`
	Key          string `json:"key"`
}

// GetPresignedURL generates an S3 presigned PUT URL for direct file upload (authenticated users).
func (ctrl *Ctrl) GetPresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Validate category
	switch req.Category {
	case "covers", "videos", "images":
	default:
		return nil, httperrors.ErrInvalidArguments
	}

	result, err := ctrl.service.GetPresignedURL(req.Filename, req.ContentType, req.Category)
	if err != nil {
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		Key:          result.Key,
	}, nil
}

// GetProfilePresignedURL generates an S3 presigned PUT URL for avatar upload (authenticated users).
func (ctrl *Ctrl) GetProfilePresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	// Only allow avatars category for profile uploads
	if req.Category != "avatars" {
		return nil, httperrors.ErrInvalidArguments
	}

	result, err := ctrl.service.GetPresignedURL(req.Filename, req.ContentType, req.Category)
	if err != nil {
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		Key:          result.Key,
	}, nil
}

// GetFile resolves an S3 object key to an access URL and redirects.
// Uses public URL if configured, otherwise generates a presigned GET URL.
func (ctrl *Ctrl) GetFile(c *fox.Context) {
	key := c.Param("path")
	key = strings.TrimPrefix(key, "/")

	if key == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	url, err := ctrl.service.GetFileURL(key)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}
