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

// PresignResult contains the presigned upload URL and the S3 object key.
type PresignResult struct {
	PresignedURL string `json:"presigned_url"`
	Key          string `json:"key"`
}

// GetPresignedURL generates an S3 presigned PUT URL for attachment upload.
// S3 key: attachments/{uuid}.{ext}, returned key: {uuid}.{ext}
func (s *Service) GetPresignedURL(filename, contentType string) (*PresignResult, error) {
	return s.presignUpload(filename, contentType, "attachments")
}

// GetAvatarPresignedURL generates an S3 presigned PUT URL for avatar upload.
// S3 key: avatars/{uuid}.{ext}, returned key: {uuid}.{ext}
func (s *Service) GetAvatarPresignedURL(filename, contentType string) (*PresignResult, error) {
	return s.presignUpload(filename, contentType, "avatars")
}

// presignUpload generates an S3 presigned PUT URL under the given prefix.
func (s *Service) presignUpload(filename, contentType, prefix string) (*PresignResult, error) {
	cfg, err := s.GetS3Config()
	if err != nil {
		return nil, fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return nil, fmt.Errorf("s3 storage not configured")
	}

	ext := strings.ToLower(filepath.Ext(filename))
	name := uuid.Must(uuid.NewV7()).String() + ext
	s3Key := prefix + "/" + name

	client := s.newS3Client(cfg)
	presignClient := s3.NewPresignClient(client)

	req, err := presignClient.PresignPutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(cfg.Bucket),
		Key:         aws.String(s3Key),
		ContentType: aws.String(contentType),
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return nil, fmt.Errorf("presign put object: %w", err)
	}

	return &PresignResult{
		PresignedURL: req.URL,
		Key:          name,
	}, nil
}

// GetFileURL returns an access URL for the given S3 object key.
// If PublicURL is configured, returns a direct public URL; otherwise returns a presigned GET URL.
func (s *Service) GetFileURL(key string) (string, error) {
	cfg, err := s.GetS3Config()
	if err != nil {
		return "", fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return "", fmt.Errorf("s3 storage not configured")
	}

	if cfg.PublicURL != "" {
		return strings.TrimRight(cfg.PublicURL, "/") + "/" + key, nil
	}

	client := s.newS3Client(cfg)
	presignClient := s3.NewPresignClient(client)

	req, err := presignClient.PresignGetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(cfg.Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(1*time.Hour))
	if err != nil {
		return "", fmt.Errorf("presign get object: %w", err)
	}

	return req.URL, nil
}

// newS3Client creates an S3 client from the given config.
func (s *Service) newS3Client(cfg *entity.S3Config) *s3.Client {
	endpoint := cfg.Endpoint
	if !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		endpoint = "https://" + endpoint
	}

	return s3.New(s3.Options{
		BaseEndpoint: aws.String(endpoint),
		Region:       cfg.Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	})
}
