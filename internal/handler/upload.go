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
}

// PresignResponse represents the presigned URL response.
type PresignResponse struct {
	PresignedURL string `json:"presigned_url"`
	Key          string `json:"key"`
}

// GetPresignedURL generates an S3 presigned PUT URL for attachment upload (authenticated users).
func (ctrl *Ctrl) GetPresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	result, err := ctrl.service.GetPresignedURL(ctx, req.Filename, req.ContentType)
	if err != nil {
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		Key:          result.Key,
	}, nil
}

// GetAvatarPresignedURL generates an S3 presigned PUT URL for avatar upload (authenticated users).
func (ctrl *Ctrl) GetAvatarPresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	result, err := ctrl.service.GetAvatarPresignedURL(ctx, req.Filename, req.ContentType)
	if err != nil {
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		Key:          result.Key,
	}, nil
}

// GetAttachmentFile resolves an attachment S3 key and redirects to the access URL.
// Route: /attachments/*path → S3 key: attachments/{path}
func (ctrl *Ctrl) GetAttachmentFile(c *fox.Context) {
	ctx := c.Logger.WithContext(c.Request.Context())

	filePath := strings.TrimPrefix(c.Param("path"), "/")
	if filePath == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	url, err := ctrl.service.GetFileURL(ctx, "attachments/"+filePath, c.Request.URL.RawQuery)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GetAvatarFile resolves an avatar S3 key and redirects to the access URL.
// Route: /avatars/*path → S3 key: avatars/{path}
func (ctrl *Ctrl) GetAvatarFile(c *fox.Context) {
	ctx := c.Logger.WithContext(c.Request.Context())

	filePath := strings.TrimPrefix(c.Param("path"), "/")
	if filePath == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	url, err := ctrl.service.GetFileURL(ctx, "avatars/"+filePath, c.Request.URL.RawQuery)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GetSiteResourceFile resolves a site resource S3 key and redirects to the access URL.
// Route: /site-resources/*path -> S3 key: site-resources/{path}
func (ctrl *Ctrl) GetSiteResourceFile(c *fox.Context) {
	ctx := c.Logger.WithContext(c.Request.Context())

	filePath := strings.TrimPrefix(c.Param("path"), "/")
	if filePath == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	url, err := ctrl.service.GetFileURL(ctx, "site-resources/"+filePath, c.Request.URL.RawQuery)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}

	c.Redirect(http.StatusTemporaryRedirect, url)
}

// GetSiteResourcePresignedURL generates a S3 presigned PUT URL for site resources (logo, favicon).
// Route: POST /api/v1/admin/upload/site-resource
func (ctrl *Ctrl) GetSiteResourcePresignedURL(c *fox.Context, req *PresignRequest) (*PresignResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	result, err := ctrl.service.GetSiteResourcePresignedURL(ctx, req.Filename, req.ContentType)
	if err != nil {
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}

	return &PresignResponse{
		PresignedURL: result.PresignedURL,
		Key:          result.Key,
	}, nil
}
