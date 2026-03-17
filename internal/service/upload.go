package service

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"

	"github.com/miclle/niubility/internal/entity"
)

// PresignResult contains the presigned upload URL and the final public file URL.
type PresignResult struct {
	PresignedURL string `json:"presigned_url"`
	FileURL      string `json:"file_url"`
}

// GetPresignedURL generates an S3 presigned PUT URL for direct file upload.
// The key format is: uploads/{category}/{YYYY-MM}/{uuid}.{ext}
func (s *Service) GetPresignedURL(filename, contentType, category string) (*PresignResult, error) {
	cfg, err := s.GetS3Config()
	if err != nil {
		return nil, fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return nil, fmt.Errorf("s3 storage not configured")
	}

	ext := strings.ToLower(filepath.Ext(filename))
	now := time.Now()
	key := fmt.Sprintf("uploads/%s/%s/%s%s", category, now.Format("2006-01"), uuid.New().String(), ext)

	client := s.newS3Client(cfg)
	presignClient := s3.NewPresignClient(client)

	req, err := presignClient.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return nil, fmt.Errorf("presign put object: %w", err)
	}

	fileURL := s.buildFileURL(cfg, key)

	return &PresignResult{
		PresignedURL: req.URL,
		FileURL:      fileURL,
	}, nil
}

// newS3Client creates an S3 client from the given config.
func (s *Service) newS3Client(cfg *entity.S3Config) *s3.Client {
	return s3.New(s3.Options{
		BaseEndpoint: aws.String(cfg.Endpoint),
		Region:       cfg.Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	})
}

// buildFileURL constructs the public access URL for an uploaded file.
// Uses PublicURL if configured, otherwise falls back to endpoint + bucket.
func (s *Service) buildFileURL(cfg *entity.S3Config, key string) string {
	if cfg.PublicURL != "" {
		base := strings.TrimRight(cfg.PublicURL, "/")
		return fmt.Sprintf("%s/%s", base, key)
	}
	endpoint := strings.TrimRight(cfg.Endpoint, "/")
	return fmt.Sprintf("%s/%s/%s", endpoint, cfg.Bucket, key)
}
