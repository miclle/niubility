package handler

import (
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
	FileURL      string `json:"file_url"`
}

// GetPresignedURL generates an S3 presigned PUT URL for direct file upload (admin only).
func (ctrl *Ctrl) GetPresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	// Validate category
	switch req.Category {
	case "covers", "videos", "images":
	default:
		return nil, httperrors.ErrInvalidArguments
	}

	result, err := ctrl.service.GetPresignedURL(req.Filename, req.ContentType, req.Category)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		FileURL:      result.FileURL,
	}, nil
}
