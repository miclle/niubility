// Package content provides content upload utilities
package content

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gabriel-vasile/mimetype"
	"github.com/miclle/niubility/cli/internal/api"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
)

// Uploader handles file uploads
type Uploader struct {
	client *api.Client
}

// NewUploader creates a new uploader
func NewUploader(client *api.Client) *Uploader {
	return &Uploader{client: client}
}

// UploadFile uploads a single file and returns the key and URL
// The returned url is the access URL for the uploaded file
func (u *Uploader) UploadFile(ctx context.Context, localPath string) (key string, accessURL string, err error) {
	// Read file
	file, err := os.Open(localPath)
	if err != nil {
		return "", "", fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.OpenFile", "failed to open file", nil), err)
	}
	defer func() {
		_ = file.Close()
	}()

	// Detect MIME type
	mtype, err := mimetype.DetectReader(file)
	if err != nil {
		return "", "", fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.DetectMIME", "failed to detect MIME type", nil), err)
	}
	// Reset reader position
	if _, err := file.Seek(0, 0); err != nil {
		return "", "", fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.SeekFile", "failed to seek file", nil), err)
	}

	// Get presigned URL with actual MIME type
	filename := filepath.Base(localPath)
	presign, err := u.client.PresignUpload(ctx, filename, mtype.String())
	if err != nil {
		return "", "", fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.GetPresignedURL", "failed to get presigned URL", nil), err)
	}

	// Upload to S3
	if err := u.client.Upload(ctx, presign.PresignedURL, mtype.String(), file); err != nil {
		return "", "", fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.UploadFile", "failed to upload file", nil), err)
	}

	return presign.Key, attachmentAccessURL(presign.Key), nil
}

// UploadResult contains the result of uploading attachments
type UploadResult struct {
	// Attachments is the list of uploaded attachments
	Attachments []api.Attachment

	// CoverURL is the access URL for the cover image
	CoverURL string

	// BodyHTML is the body HTML with local image paths replaced
	BodyHTML string
}

// UploadAttachments uploads all attachments from an article and returns the result
func UploadAttachments(ctx context.Context, client *api.Client, article *Article, basePath string) (*UploadResult, error) {
	uploader := NewUploader(client)
	var attachments []api.Attachment
	var coverURL string
	imageURLMap := make(map[string]string) // local path -> access URL

	// Upload cover image
	if article.CoverPath != "" {
		key, _, err := uploader.UploadFile(ctx, article.CoverPath)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", clii18n.T("ContentUpload.Error.UploadCover", "failed to upload cover", nil), err)
		}
		coverURL = key
		attachments = append(attachments, api.Attachment{
			Type:     "image",
			Filename: filepath.Base(article.CoverPath),
			URL:      key,
			IsCover:  true,
		})
	}

	// Upload body images and track URL mapping
	for _, imgPath := range article.ImagePaths {
		key, accessURL, err := uploader.UploadFile(ctx, imgPath)
		if err != nil {
			return nil, fmt.Errorf("%s %s: %w", clii18n.T("ContentUpload.Error.UploadImage", "failed to upload image", nil), imgPath, err)
		}
		imageURLMap[imgPath] = accessURL
		attachments = append(attachments, api.Attachment{
			Type:     "image",
			Filename: filepath.Base(imgPath),
			URL:      key,
		})
	}

	// Upload document attachments
	for _, attPath := range article.Attachments {
		key, _, err := uploader.UploadFile(ctx, attPath)
		if err != nil {
			return nil, fmt.Errorf("%s %s: %w", clii18n.T("ContentUpload.Error.UploadAttachment", "failed to upload attachment", nil), attPath, err)
		}
		attachments = append(attachments, api.Attachment{
			Type:     "document",
			Filename: filepath.Base(attPath),
			URL:      key,
		})
	}

	// Replace local image paths in body HTML with access URLs
	bodyHTML := replaceImageURLs(article.BodyHTML, imageURLMap)

	return &UploadResult{
		Attachments: attachments,
		CoverURL:    coverURL,
		BodyHTML:    bodyHTML,
	}, nil
}

// replaceImageURLs replaces local image paths with URLs in the body HTML
func replaceImageURLs(bodyHTML string, imageURLMap map[string]string) string {
	result := bodyHTML
	for localPath, accessURL := range imageURLMap {
		// Replace the path in both src attributes and href attributes
		// Also handle both forward and backward slashes for cross-platform compatibility
		result = strings.ReplaceAll(result, localPath, accessURL)
		// Handle relative path format (./path)
		if strings.HasPrefix(localPath, "./") {
			result = strings.ReplaceAll(result, localPath[2:], accessURL)
		}
	}
	return result
}

func attachmentAccessURL(key string) string {
	if key == "" {
		return ""
	}
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") || strings.HasPrefix(key, "/") {
		return key
	}
	return "/attachments/" + key
}
