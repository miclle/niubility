package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/fox-gonic/fox/logger"
	"github.com/google/uuid"

	"github.com/miclle/niubility/internal/entity"
)

// PresignResult contains the presigned upload URL and the S3 object key.
type PresignResult struct {
	PresignedURL string `json:"presigned_url"`
	Key          string `json:"key"`
}

// FileDownloadResult contains the streamed file body and response metadata for direct downloads.
type FileDownloadResult struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
}

// GetPresignedURL generates an S3 presigned PUT URL for attachment upload.
// S3 key: attachments/{uuid}.{ext}, returned key: {uuid}.{ext}
func (s *Service) GetPresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error) {
	return s.presignUpload(ctx, filename, contentType, "attachments")
}

// GetAvatarPresignedURL generates an S3 presigned PUT URL for avatar upload.
// S3 key: avatars/{uuid}.{ext}, returned key: {uuid}.{ext}
func (s *Service) GetAvatarPresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error) {
	return s.presignUpload(ctx, filename, contentType, "avatars")
}

// GetSiteResourcePresignedURL generates an S3 presigned PUT URL for site resources (logo, favicon).
// S3 key: site-resources/{uuid}.{ext}, returned key: {uuid}.{ext}
func (s *Service) GetSiteResourcePresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error) {
	return s.presignUpload(ctx, filename, contentType, "site-resources")
}

// presignUpload generates an S3 presigned PUT URL under the given prefix.
func (s *Service) presignUpload(ctx context.Context, filename, contentType, prefix string) (*PresignResult, error) {
	log := logger.NewWithContext(ctx)

	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		log.Errorf("presignUpload: get s3 config: %v", err)
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

	req, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(cfg.Bucket),
		Key:         aws.String(s3Key),
		ContentType: aws.String(contentType),
		// Note: ChecksumAlgorithm is not set here for better compatibility with S3-compatible services
		// (e.g., MinIO, Ceph) which may not support this parameter
	}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		log.Errorf("presignUpload: presign put object: %v", err)
		return nil, fmt.Errorf("presign put object: %w", err)
	}

	return &PresignResult{
		PresignedURL: req.URL,
		Key:          name,
	}, nil
}

// GetFileURL returns an access URL for the given S3 object key.
// If PublicURL is configured, returns a direct public URL; otherwise returns a presigned GET URL.
func (s *Service) GetFileURL(ctx context.Context, key, rawQuery string) (string, error) {
	log := logger.NewWithContext(ctx)

	deliveryCfg, err := s.GetDeliveryConfig(ctx)
	if err != nil {
		log.Errorf("GetFileURL: get delivery config: %v", err)
		return "", fmt.Errorf("get delivery config: %w", err)
	}
	if deliveryCfg != nil {
		if deliveryURL, handled, err := s.getDeliveryURL(ctx, deliveryCfg, key, rawQuery); handled {
			return deliveryURL, err
		}
	}

	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		log.Errorf("GetFileURL: get s3 config: %v", err)
		return "", fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return "", fmt.Errorf("s3 storage not configured")
	}

	if cfg.PublicURL != "" {
		if !supportsImageStyleForKey(key) {
			rawQuery = stripStyleRequest(rawQuery)
		}
		return buildGenericAssetURL(strings.TrimRight(cfg.PublicURL, "/")+"/"+key, rawQuery, "auto"), nil
	}

	client := s.newS3Client(cfg)
	presignClient := s3.NewPresignClient(client)

	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(cfg.Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(1*time.Hour))
	if err != nil {
		log.Errorf("GetFileURL: presign get object: %v", err)
		return "", fmt.Errorf("presign get object: %w", err)
	}

	return req.URL, nil
}

// GetFileDownload streams the original object from S3-compatible storage for direct downloads.
func (s *Service) GetFileDownload(ctx context.Context, key string) (*FileDownloadResult, error) {
	log := logger.NewWithContext(ctx)

	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		log.Errorf("GetFileDownload: get s3 config: %v", err)
		return nil, fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return nil, fmt.Errorf("s3 storage not configured")
	}

	client := s.newS3Client(cfg)
	resp, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		log.Errorf("GetFileDownload: get object: %v", err)
		return nil, fmt.Errorf("get object: %w", err)
	}

	return &FileDownloadResult{
		Body:          resp.Body,
		ContentType:   aws.ToString(resp.ContentType),
		ContentLength: aws.ToInt64(resp.ContentLength),
	}, nil
}

func (s *Service) getDeliveryURL(ctx context.Context, cfg *entity.DeliveryConfig, key, rawQuery string) (string, bool, error) {
	if cfg == nil {
		return "", false, nil
	}

	switch strings.ToLower(strings.TrimSpace(cfg.Provider)) {
	case "qiniu":
		s3Cfg, err := s.GetS3Config(ctx)
		if err != nil {
			return "", true, fmt.Errorf("get s3 config for qiniu delivery: %w", err)
		}
		url, err := buildQiniuDeliveryURL(cfg, s3Cfg, key, rawQuery)
		return url, true, err
	default:
		return "", false, nil
	}
}

func appendRawQuery(rawURL, rawQuery string) string {
	rawQuery = strings.TrimLeft(strings.TrimSpace(rawQuery), "?&")
	if rawQuery == "" {
		return rawURL
	}
	if strings.Contains(rawURL, "?") {
		return rawURL + "&" + rawQuery
	}
	return rawURL + "?" + rawQuery
}

func extractStyleRequest(rawQuery string) (style string, passthrough string) {
	normalized := strings.TrimLeft(strings.TrimSpace(rawQuery), "?&")
	if normalized == "" {
		return "", ""
	}
	if !strings.Contains(normalized, "=") {
		return normalized, ""
	}

	values, err := url.ParseQuery(normalized)
	if err != nil {
		return normalized, ""
	}

	style = strings.TrimSpace(values.Get("style"))
	values.Del("style")
	passthrough = values.Encode()
	return style, passthrough
}

func supportsImageStyleForKey(key string) bool {
	ext := strings.ToLower(strings.TrimSpace(filepath.Ext(strings.TrimSpace(key))))
	return ext != ".svg" && ext != ".svgz"
}

func stripStyleRequest(rawQuery string) string {
	_, passthrough := extractStyleRequest(rawQuery)
	return passthrough
}

func normalizeDownloadQuery(rawQuery string) string {
	normalized := strings.TrimLeft(strings.TrimSpace(rawQuery), "?&")
	if normalized == "" {
		return ""
	}
	values, err := url.ParseQuery(normalized)
	if err != nil {
		return normalized
	}

	download := strings.TrimSpace(values.Get("download"))
	if download != "" {
		values.Del("download")
		if download == "1" {
			values.Set("attname", "download")
		} else {
			values.Set("attname", download)
		}
	}
	return values.Encode()
}

func isNamedStyle(style string) bool {
	style = strings.TrimSpace(style)
	if style == "" {
		return false
	}
	return !strings.ContainsAny(style, "/|&=?")
}

func normalizeStyleMode(styleMode string) string {
	switch strings.ToLower(strings.TrimSpace(styleMode)) {
	case "path_suffix":
		return "path_suffix"
	case "query":
		return "query"
	default:
		return "auto"
	}
}

func buildGenericAssetURL(baseURL, rawQuery, styleMode string) string {
	style, passthrough := extractStyleRequest(rawQuery)
	finalURL := appendRawQuery(baseURL, normalizeDownloadQuery(passthrough))
	if style == "" {
		return finalURL
	}
	if normalizeStyleMode(styleMode) == "path_suffix" && isNamedStyle(style) {
		return finalURL + "-" + style
	}
	if isNamedStyle(style) && normalizeStyleMode(styleMode) != "query" {
		return appendRawQuery(finalURL, "style="+url.QueryEscape(style))
	}
	return appendRawQuery(finalURL, style)
}

func buildQiniuDeliveryURL(cfg *entity.DeliveryConfig, s3Cfg *entity.S3Config, key, rawQuery string) (string, error) {
	if cfg == nil || strings.TrimSpace(cfg.Domain) == "" {
		return "", fmt.Errorf("delivery domain is empty")
	}
	if !supportsImageStyleForKey(key) {
		rawQuery = stripStyleRequest(rawQuery)
	}

	style, passthrough := extractStyleRequest(rawQuery)
	baseURL := strings.TrimRight(cfg.Domain, "/") + "/" + strings.TrimLeft(key, "/")
	styleMode := normalizeStyleMode(cfg.StyleMode)
	if (styleMode == "path_suffix" || styleMode == "auto") && isNamedStyle(style) {
		baseURL += "-" + style
		style = ""
	}

	finalURL := buildGenericAssetURL(baseURL, passthrough, styleMode)
	finalURL = appendRawQuery(finalURL, style)
	if !cfg.PrivateEnabled {
		return finalURL, nil
	}
	if s3Cfg == nil || strings.TrimSpace(s3Cfg.AccessKey) == "" || strings.TrimSpace(s3Cfg.SecretKey) == "" {
		return "", fmt.Errorf("qiniu private delivery requires s3 access key and secret key")
	}

	deadline := time.Now().Add(time.Duration(cfg.URLTTLSeconds) * time.Second).Unix()
	finalURL = appendRawQuery(finalURL, "e="+fmt.Sprintf("%d", deadline))

	mac := hmac.New(sha1.New, []byte(s3Cfg.SecretKey))
	mac.Write([]byte(finalURL))
	sign := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(mac.Sum(nil))
	token := s3Cfg.AccessKey + ":" + sign

	return appendRawQuery(finalURL, "token="+url.QueryEscape(token)), nil
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

// ConfigureS3CORS sets the CORS configuration on the S3 bucket to allow browser-based uploads.
// It uses the CORSOrigin from S3Config as AllowedOrigin. Skips if CORSOrigin is empty.
func (s *Service) ConfigureS3CORS(ctx context.Context) error {
	log := logger.NewWithContext(ctx)

	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		return fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return fmt.Errorf("s3 storage not configured")
	}
	if cfg.CORSOrigin == "" {
		log.Info("ConfigureS3CORS: cors_origin is empty, skipping")
		return nil
	}

	// Parse origins: one per line, skip empty lines
	var origins []string
	for _, line := range strings.Split(cfg.CORSOrigin, "\n") {
		origin := strings.TrimSpace(line)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		log.Info("ConfigureS3CORS: no valid origins, skipping")
		return nil
	}

	client := s.newS3Client(cfg)

	_, err = client.PutBucketCors(ctx, &s3.PutBucketCorsInput{
		Bucket: aws.String(cfg.Bucket),
		CORSConfiguration: &s3types.CORSConfiguration{
			CORSRules: []s3types.CORSRule{
				{
					AllowedOrigins: origins,
					AllowedMethods: []string{"GET", "PUT", "POST", "HEAD"},
					AllowedHeaders: []string{"Content-Type"},
					ExposeHeaders:  []string{"ETag"},
					MaxAgeSeconds:  aws.Int32(3600),
				},
			},
		},
	}, withContentMD5)
	if err != nil {
		log.Errorf("ConfigureS3CORS: put bucket cors: %v", err)
		return fmt.Errorf("put bucket cors: %w", err)
	}

	log.Infof("ConfigureS3CORS: configured CORS for bucket %s, origin: %s", cfg.Bucket, cfg.CORSOrigin)
	return nil
}

// withContentMD5 is an S3 option that adds Content-MD5 header computation middleware.
// Some S3-compatible services (e.g., MinIO, Ceph) require Content-MD5 for certain operations,
// but aws-sdk-go-v2 no longer adds it by default.
func withContentMD5(o *s3.Options) {
	o.APIOptions = append(o.APIOptions, func(stack *middleware.Stack) error {
		return stack.Build.Add(middleware.BuildMiddlewareFunc("ContentMD5",
			func(ctx context.Context, in middleware.BuildInput, next middleware.BuildHandler) (middleware.BuildOutput, middleware.Metadata, error) {
				req, ok := in.Request.(*smithyhttp.Request)
				if !ok {
					return next.HandleBuild(ctx, in)
				}
				body := req.GetStream()
				if body == nil {
					return next.HandleBuild(ctx, in)
				}
				content, err := io.ReadAll(body)
				if err != nil {
					return middleware.BuildOutput{}, middleware.Metadata{}, fmt.Errorf("read request body: %w", err)
				}
				hash := md5.Sum(content)
				req.Header.Set("Content-MD5", base64.StdEncoding.EncodeToString(hash[:]))
				req, _ = req.SetStream(bytes.NewReader(content))
				in.Request = req
				return next.HandleBuild(ctx, in)
			},
		), middleware.Before)
	})
}
