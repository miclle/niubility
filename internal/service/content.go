package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

func normalizeAttachmentArgs(items []entity.CreateAttachmentArgs) []entity.CreateAttachmentArgs {
	if len(items) == 0 {
		return items
	}

	normalized := make([]entity.CreateAttachmentArgs, len(items))
	for i, item := range items {
		item.URL = entity.NormalizeAttachmentStorageURL(item.URL)
		item.CoverURL = entity.NormalizeAttachmentStorageURL(item.CoverURL)
		normalized[i] = item
	}

	return normalized
}

// GalleryVideoMaxFileSize is the maximum file size for videos in gallery content (200 MB).
const GalleryVideoMaxFileSize int64 = 200 * 1024 * 1024

const listContentSelect = `contents.*, CASE
	WHEN contents.type = 'gallery' THEN COALESCE((
		SELECT COALESCE(NULLIF(attachments.cover_url, ''), attachments.url)
		FROM attachments
		WHERE attachments.content_id = contents.id
		ORDER BY
			CASE WHEN attachments.is_cover THEN 0 ELSE 1 END,
			attachments.sort_order ASC,
			attachments.created_at ASC,
			attachments.id ASC
		LIMIT 1
	), contents.cover_url)
	ELSE contents.cover_url
END AS cover_url`

func applyContentListSelects(query *gorm.DB) *gorm.DB {
	return query.Select(listContentSelect)
}

func galleryCoverURL(items []entity.CreateAttachmentArgs) string {
	if len(items) == 0 {
		return ""
	}

	for _, item := range items {
		if item.IsCover {
			if item.CoverURL != "" {
				return item.CoverURL
			}
			return item.URL
		}
	}

	first := items[0]
	if first.CoverURL != "" {
		return first.CoverURL
	}
	return first.URL
}

func hasAuthorVisibleContentChanges(args entity.UpdateContentArgs) bool {
	return args.Title != nil ||
		args.Summary != nil ||
		args.Body != nil ||
		args.CoverURL != nil ||
		args.Type != nil ||
		args.Category != nil ||
		args.Tags != nil ||
		args.SpeakerID != nil ||
		args.SpeakerName != nil ||
		args.SpeakerBio != nil ||
		args.Attachments != nil
}

func scopePublicListVisible(query *gorm.DB) *gorm.DB {
	return query.Where("status = ?", entity.ContentStatusPublished).
		Where("(review_status = ? OR review_status = '')", entity.ContentReviewStatusApproved).
		Where("(visibility = ? OR visibility = '')", entity.ContentVisibilityPublic)
}

func scopePublicDetailVisible(query *gorm.DB) *gorm.DB {
	return query.Where("status = ?", entity.ContentStatusPublished).
		Where("(review_status = ? OR review_status = '')", entity.ContentReviewStatusApproved).
		Where("(visibility IN ? OR visibility = '')", []entity.ContentVisibility{entity.ContentVisibilityPublic, entity.ContentVisibilityUnlisted})
}

func scopeUserProfileListVisible(query *gorm.DB) *gorm.DB {
	return scopePublicListVisible(query)
}

func canUserAccessContent(user *entity.User, content *entity.Content) bool {
	if content == nil {
		return false
	}
	if user != nil && (user.IsAdmin() || user.ID == content.AuthorID) {
		return true
	}
	return content.Status == entity.ContentStatusPublished &&
		(content.ReviewStatus == "" || content.ReviewStatus == entity.ContentReviewStatusApproved) &&
		(content.Visibility == "" || content.Visibility == entity.ContentVisibilityPublic || content.Visibility == entity.ContentVisibilityUnlisted)
}

func applyContentFilters(query *gorm.DB, args entity.ListContentsArgs) *gorm.DB {
	if args.Category != "" {
		query = query.Where("category = ?", args.Category)
	}
	if args.Type != "" {
		query = query.Where("type = ?", args.Type)
	}
	if args.AuthorID != "" {
		query = query.Where("author_id = ?", args.AuthorID)
	}
	if args.SpeakerID != "" {
		query = query.Where("speaker_id = ?", args.SpeakerID)
	}
	if args.ProfileUserID != "" {
		query = query.Where(
			"(speaker_id = ?) OR ((speaker_id = '' OR speaker_id IS NULL) AND (speaker_name = '' OR speaker_name IS NULL) AND author_id = ?)",
			args.ProfileUserID,
			args.ProfileUserID,
		)
	}
	if args.FollowedByUserID != "" {
		query = query.Where("author_id IN (SELECT following_id FROM follows WHERE follower_id = ?)", args.FollowedByUserID)
	}
	if args.Status != "" && args.Status != "all" {
		query = query.Where("status = ?", args.Status)
	}
	if args.ReviewStatus != "" && args.ReviewStatus != "all" {
		query = query.Where("review_status = ?", args.ReviewStatus)
	}
	if args.Visibility != "" && args.Visibility != "all" {
		query = query.Where("visibility = ?", args.Visibility)
	}
	return query
}

func (s *Service) whereContentKeyword(query *gorm.DB, keyword string) *gorm.DB {
	return s.whereLike(query, []string{"title", "summary"}, keyword)
}

func (s *Service) whereContentTag(query *gorm.DB, tag string) *gorm.DB {
	return s.whereJSONContains(query, "tags", fmt.Sprintf(`[%q]`, tag))
}

func (s *Service) listContentsWithScope(ctx context.Context, args entity.ListContentsArgs, scope func(*gorm.DB) *gorm.DB) ([]entity.Content, string, error) {
	log := logger.NewWithContext(ctx)

	var contents []entity.Content
	query := applyContentListSelects(s.db.WithContext(ctx).Model(&entity.Content{}))
	if scope != nil {
		query = scope(query)
	}

	query = applyContentFilters(query, args)
	if args.Keyword != "" {
		query = s.whereContentKeyword(query, "%"+args.Keyword+"%")
	}
	if args.Tag != "" {
		query = s.whereContentTag(query, args.Tag)
	}

	sortByLikes := args.Sort == entity.SortByLikeCount
	if args.Cursor != "" {
		if sortByLikes {
			parts, err := entity.DecodeCursor(args.Cursor, 3)
			if err != nil {
				return nil, "", fmt.Errorf("decode cursor: %w", err)
			}
			likeCount, err := strconv.ParseInt(parts[0], 10, 64)
			if err != nil {
				return nil, "", fmt.Errorf("parse cursor like_count: %w", err)
			}
			cursorTime, err := time.Parse(time.RFC3339Nano, parts[1])
			if err != nil {
				return nil, "", fmt.Errorf("parse cursor created_at: %w", err)
			}
			cursorID := parts[2]
			query = query.Where("(like_count, created_at, id) < (?, ?, ?)", likeCount, cursorTime, cursorID)
		} else {
			parts, err := entity.DecodeCursor(args.Cursor, 2)
			if err != nil {
				return nil, "", fmt.Errorf("decode cursor: %w", err)
			}
			cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
			if err != nil {
				return nil, "", fmt.Errorf("parse cursor created_at: %w", err)
			}
			cursorID := parts[1]
			query = query.Where("(created_at, id) < (?, ?)", cursorTime, cursorID)
		}
	}

	orderClause := "created_at DESC, id DESC"
	if sortByLikes {
		orderClause = "like_count DESC, created_at DESC, id DESC"
	}

	if err := query.Preload("Author").Preload("Speaker").
		Preload("Attachments", func(db *gorm.DB) *gorm.DB {
			if args.Type != entity.ContentTypePodcast {
				return db.Where("1 = 0")
			}
			return db.Order("sort_order ASC")
		}).
		Limit(args.GetLimit()).
		Order(orderClause).
		Find(&contents).Error; err != nil {
		log.Errorf("list contents with scope: %v", err)
		return nil, "", fmt.Errorf("list contents: %w", err)
	}

	var nextCursor string
	if len(contents) == args.GetLimit() {
		last := contents[len(contents)-1]
		ts := last.CreatedAt.Format(time.RFC3339Nano)
		if sortByLikes {
			nextCursor = entity.EncodeCursor(strconv.FormatInt(last.LikeCount, 10), ts, last.ID)
		} else {
			nextCursor = entity.EncodeCursor(ts, last.ID)
		}
	}

	return contents, nextCursor, nil
}

// ListContents retrieves a paginated list of contents with optional filters using cursor-based pagination.
func (s *Service) ListContents(ctx context.Context, args entity.ListContentsArgs) ([]entity.Content, string, error) {
	if args.AuthorID != "" || args.ProfileUserID != "" {
		return s.listContentsWithScope(ctx, args, nil)
	}
	if args.Status == "all" || args.ReviewStatus == "all" || args.Visibility == "all" {
		return s.listContentsWithScope(ctx, args, nil)
	}
	return s.listContentsWithScope(ctx, args, scopePublicListVisible)
}

// ListUserPublicContents retrieves public-facing contents for a user's profile page.
func (s *Service) ListUserPublicContents(ctx context.Context, userID string, args entity.ListContentsArgs) ([]entity.Content, string, error) {
	args.AuthorID = userID
	args.ProfileUserID = ""
	return s.listContentsWithScope(ctx, args, scopeUserProfileListVisible)
}

// ListMyContents retrieves all contents authored by the current user for personal management views.
func (s *Service) ListMyContents(ctx context.Context, userID string, args entity.ListContentsArgs) ([]entity.Content, string, error) {
	args.AuthorID = userID
	return s.listContentsWithScope(ctx, args, nil)
}

// CanUserAccessContent reports whether the given user may view the content detail.
func (s *Service) CanUserAccessContent(user *entity.User, content *entity.Content) bool {
	return canUserAccessContent(user, content)
}

// GetContentByID retrieves a content by ID with author and attachments preloaded.
func (s *Service) GetContentByID(ctx context.Context, id string) (*entity.Content, error) {
	log := logger.NewWithContext(ctx)

	var content entity.Content
	if err := s.db.WithContext(ctx).Preload("Author").Preload("Speaker").Preload("Attachments", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("id = ?", id).First(&content).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("GetContentByID: %v", err)
		return nil, fmt.Errorf("get content by id: %w", err)
	}
	return &content, nil
}

// GetAttachmentByID retrieves an attachment by ID.
func (s *Service) GetAttachmentByID(ctx context.Context, id string) (*entity.Attachment, error) {
	log := logger.NewWithContext(ctx)

	var attachment entity.Attachment
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&attachment).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("GetAttachmentByID: %v", err)
		return nil, fmt.Errorf("get attachment by id: %w", err)
	}
	return &attachment, nil
}

// createAttachments creates attachments for a content, validating gallery constraints and dedup.
func (s *Service) createAttachments(tx *gorm.DB, contentID string, contentType entity.ContentType, items []entity.CreateAttachmentArgs) error {
	// Collect non-empty checksums for dedup within the batch
	seen := make(map[string]bool)

	for i, item := range items {
		// Validate gallery short video constraints
		if contentType == entity.ContentTypeGallery && item.Type == entity.AttachmentTypeVideo {
			if item.FileSize > GalleryVideoMaxFileSize {
				return fmt.Errorf("gallery video #%d exceeds 200MB limit", i+1)
			}
		}

		// Skip duplicate checksums within the same batch
		if item.Checksum != "" {
			if seen[item.Checksum] {
				continue
			}
			seen[item.Checksum] = true
		}

		attachment := entity.Attachment{
			ID:          entity.ID(),
			ContentID:   contentID,
			Title:       item.Title,
			Description: item.Description,
			Filename:    item.Filename,
			URL:         item.URL,
			CoverURL:    item.CoverURL,
			MimeType:    item.MimeType,
			Checksum:    item.Checksum,
			Type:        item.Type,
			SortOrder:   item.SortOrder,
			IsCover:     item.IsCover,
			Width:       item.Width,
			Height:      item.Height,
			FileSize:    item.FileSize,
			Duration:    item.Duration,
		}
		if err := tx.Create(&attachment).Error; err != nil {
			return fmt.Errorf("create attachment: %w", err)
		}
	}
	return nil
}

// CreateContent creates a new content record with attachments.
func (s *Service) CreateContent(ctx context.Context, content *entity.Content, attachments []entity.CreateAttachmentArgs) error {
	log := logger.NewWithContext(ctx)

	content.ID = entity.ID()
	content.CoverURL = entity.NormalizeAttachmentStorageURL(content.CoverURL)
	attachments = normalizeAttachmentArgs(attachments)
	if content.Status == "" {
		content.Status = entity.ContentStatusDraft
	}
	if content.ReviewStatus == "" {
		content.ReviewStatus = entity.ContentReviewStatusPending
	}
	if content.Visibility == "" {
		content.Visibility = entity.ContentVisibilityPrivate
	}
	if content.Type == entity.ContentTypeGallery {
		content.CoverURL = galleryCoverURL(attachments)
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(content).Error; err != nil {
			log.Errorf("CreateContent: %v", err)
			return fmt.Errorf("create content: %w", err)
		}
		if len(attachments) > 0 {
			if err := s.createAttachments(tx, content.ID, content.Type, attachments); err != nil {
				return fmt.Errorf("create content attachments: %w", err)
			}
		}
		return nil
	})
}

// UpdateContent updates content fields by ID, replacing attachments.
func (s *Service) UpdateContent(ctx context.Context, id string, args entity.UpdateContentArgs) (*entity.Content, error) {
	log := logger.NewWithContext(ctx)

	content, err := s.GetContentByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if content == nil {
		return nil, nil
	}

	updates := map[string]any{}
	if args.Title != nil {
		updates["title"] = *args.Title
	}
	if args.Summary != nil {
		updates["summary"] = *args.Summary
	}
	if args.Body != nil {
		updates["body"] = *args.Body
	}
	if args.CoverURL != nil {
		updates["cover_url"] = entity.NormalizeAttachmentStorageURL(*args.CoverURL)
	}
	if args.Type != nil {
		updates["type"] = *args.Type
	}
	if args.Category != nil {
		updates["category"] = *args.Category
	}
	if args.Tags != nil {
		tagsJSON, _ := json.Marshal(args.Tags)
		updates["tags"] = string(tagsJSON)
	}
	if args.AuthorID != nil {
		updates["author_id"] = *args.AuthorID
	}
	if args.SpeakerID != nil {
		updates["speaker_id"] = *args.SpeakerID
		if *args.SpeakerID != "" {
			updates["speaker_name"] = ""
		}
	}
	if args.SpeakerName != nil {
		updates["speaker_name"] = *args.SpeakerName
		if *args.SpeakerName != "" {
			updates["speaker_id"] = ""
		}
	}
	if args.SpeakerBio != nil {
		updates["speaker_bio"] = *args.SpeakerBio
	}
	if args.Status != nil {
		updates["status"] = *args.Status
		if *args.Status == entity.ContentStatusDraft {
			updates["review_status"] = entity.ContentReviewStatusPending
			updates["visibility"] = entity.ContentVisibilityPrivate
			updates["reviewed_by"] = ""
			updates["reviewed_at"] = nil
			updates["review_note"] = ""
		}
		if *args.Status == entity.ContentStatusPublished && content.Status != entity.ContentStatusPublished && args.ReviewStatus == nil && args.Visibility == nil {
			updates["review_status"] = entity.ContentReviewStatusPending
			updates["visibility"] = entity.ContentVisibilityPrivate
			updates["reviewed_by"] = ""
			updates["reviewed_at"] = nil
			updates["review_note"] = ""
		}
	}
	if !args.ByAdmin && content.Status == entity.ContentStatusPublished && args.ReviewStatus == nil && args.Visibility == nil {
		targetStatus := content.Status
		if args.Status != nil {
			targetStatus = *args.Status
		}
		if targetStatus == entity.ContentStatusPublished && hasAuthorVisibleContentChanges(args) {
			updates["review_status"] = entity.ContentReviewStatusPending
			updates["visibility"] = entity.ContentVisibilityPrivate
			updates["reviewed_by"] = ""
			updates["reviewed_at"] = nil
			updates["review_note"] = ""
		}
	}
	if args.ReviewStatus != nil {
		updates["review_status"] = *args.ReviewStatus
	}
	if args.Visibility != nil {
		updates["visibility"] = *args.Visibility
	}
	if args.ReviewedBy != nil {
		updates["reviewed_by"] = *args.ReviewedBy
	}
	if args.ReviewedAt != nil {
		updates["reviewed_at"] = *args.ReviewedAt
	}
	if args.ReviewNote != nil {
		updates["review_note"] = *args.ReviewNote
	}
	// Admin can override timestamps (e.g. for importing legacy content)
	if args.CreatedAt != nil {
		updates["created_at"] = *args.CreatedAt
	}
	if args.UpdatedAt != nil {
		updates["updated_at"] = *args.UpdatedAt
	}

	// Determine content type for validation
	contentType := content.Type
	if args.Type != nil {
		contentType = *args.Type
	}
	if args.Attachments != nil {
		args.Attachments = normalizeAttachmentArgs(args.Attachments)
	}
	if args.Attachments != nil && contentType == entity.ContentTypeGallery {
		updates["cover_url"] = galleryCoverURL(args.Attachments)
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			updateColumns := make([]string, 0, len(updates))
			for column := range updates {
				updateColumns = append(updateColumns, column)
			}
			if err := tx.Model(content).Select(updateColumns).Updates(updates).Error; err != nil {
				log.Errorf("UpdateContent: %v", err)
				return fmt.Errorf("update content: %w", err)
			}
		}

		// Replace attachments if provided (full replacement strategy)
		if args.Attachments != nil {
			if err := tx.Where("content_id = ?", id).Delete(&entity.Attachment{}).Error; err != nil {
				return fmt.Errorf("delete old attachments: %w", err)
			}
			if len(args.Attachments) > 0 {
				if err := s.createAttachments(tx, id, contentType, args.Attachments); err != nil {
					return fmt.Errorf("replace content attachments: %w", err)
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetContentByID(ctx, id)
}

// DeleteContent deletes a content and its attachments by ID.
func (s *Service) DeleteContent(ctx context.Context, id string) error {
	log := logger.NewWithContext(ctx)

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("content_id = ?", id).Delete(&entity.Attachment{}).Error; err != nil {
			log.Errorf("DeleteContent: delete attachments: %v", err)
			return fmt.Errorf("delete attachments: %w", err)
		}
		result := tx.Where("id = ?", id).Delete(&entity.Content{})
		if result.Error != nil {
			log.Errorf("DeleteContent: delete content: %v", result.Error)
			return fmt.Errorf("delete content: %w", result.Error)
		}
		return nil
	})
}
