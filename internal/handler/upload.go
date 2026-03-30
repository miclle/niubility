package handler

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
)

func sanitizeDownloadFilename(filename string) string {
	filename = strings.TrimSpace(filename)
	filename = strings.ReplaceAll(filename, "\r", "")
	filename = strings.ReplaceAll(filename, "\n", "")
	filename = strings.ReplaceAll(filename, "\"", "")
	if filename == "" {
		filename = "download"
	}
	return filename
}

func contentDisposition(filename string) string {
	filename = sanitizeDownloadFilename(filename)
	return fmt.Sprintf("attachment; filename=\"%s\"; filename*=UTF-8''%s", filename, url.PathEscape(filename))
}

func (ctrl *Ctrl) serveFileDownload(c *fox.Context, key, fallbackName string) bool {
	download := strings.TrimSpace(c.Query("download"))
	if download == "" {
		return false
	}
	if download == "1" {
		download = fallbackName
	}
	if download == "" {
		download = "download"
	}

	ctx := c.Logger.WithContext(c.Request.Context())
	result, err := ctrl.service.GetFileDownload(ctx, key)
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return true
	}
	defer result.Body.Close()

	if result.ContentType != "" {
		c.Header("Content-Type", result.ContentType)
	} else {
		c.Header("Content-Type", "application/octet-stream")
	}
	if result.ContentLength > 0 {
		c.Header("Content-Length", fmt.Sprintf("%d", result.ContentLength))
	}
	c.Header("Content-Disposition", contentDisposition(download))
	c.Status(http.StatusOK)
	if _, err := io.Copy(c.Writer, result.Body); err != nil {
		c.Error(err)
	}
	return true
}

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
	if ctrl.serveFileDownload(c, "attachments/"+filePath, path.Base(filePath)) {
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
	if ctrl.serveFileDownload(c, "avatars/"+filePath, path.Base(filePath)) {
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
	if ctrl.serveFileDownload(c, "site-resources/"+filePath, path.Base(filePath)) {
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
