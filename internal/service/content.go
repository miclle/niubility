package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// GalleryVideoMaxFileSize is the maximum file size for short videos in gallery content (20 MB).
const GalleryVideoMaxFileSize int64 = 20 * 1024 * 1024

// ListContents retrieves a paginated list of contents with optional filters.
func (s *Service) ListContents(args entity.ListContentsArgs) ([]entity.Content, int64, error) {
	var contents []entity.Content
	var total int64

	query := s.DB.Model(&entity.Content{})

	if args.Category != "" {
		query = query.Where("category = ?", args.Category)
	}
	if args.Type != "" {
		query = query.Where("type = ?", args.Type)
	}
	if args.Keyword != "" {
		keyword := "%" + args.Keyword + "%"
		query = query.Where("title ILIKE ? OR summary ILIKE ?", keyword, keyword)
	}
	if args.Tag != "" {
		query = query.Where("tags::jsonb @> ?", fmt.Sprintf(`[%q]`, args.Tag))
	}
	if args.AuthorID != "" {
		query = query.Where("author_id = ?", args.AuthorID)
	}
	if args.SpeakerID != "" {
		query = query.Where("speaker_id = ?", args.SpeakerID)
	}
	if args.FollowedByUserID != "" {
		query = query.Where("author_id IN (SELECT following_id FROM follows WHERE follower_id = ?)", args.FollowedByUserID)
	}
	if args.Status != "" && args.Status != "all" {
		query = query.Where("status = ?", args.Status)
	} else if args.Status == "" {
		// Default to published content for public listings
		query = query.Where("status = ?", entity.ContentStatusPublished)
	}
	// When args.Status == "all", no filter is applied

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count contents: %w", err)
	}

	// sorting
	orderClause := "created_at DESC"
	if args.Sort == entity.SortByLikeCount {
		orderClause = "like_count DESC"
	}

	if err := query.Preload("Author").Preload("Speaker").Preload("Attachments", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Offset(args.Offset()).Limit(args.GetLimit()).Order(orderClause).Find(&contents).Error; err != nil {
		return nil, 0, fmt.Errorf("list contents: %w", err)
	}

	return contents, total, nil
}

// GetContentByID retrieves a content by ID with author and attachments preloaded.
func (s *Service) GetContentByID(id string) (*entity.Content, error) {
	var content entity.Content
	if err := s.DB.Preload("Author").Preload("Speaker").Preload("Attachments", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Where("id = ?", id).First(&content).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get content by id: %w", err)
	}
	return &content, nil
}

// createAttachments creates attachments for a content, validating gallery constraints.
func (s *Service) createAttachments(tx *gorm.DB, contentID string, contentType entity.ContentType, items []entity.CreateAttachmentArgs) error {
	for i, item := range items {
		// Validate gallery short video constraints
		if contentType == entity.ContentTypeGallery && item.Type == entity.AttachmentTypeVideo {
			if item.FileSize > GalleryVideoMaxFileSize {
				return fmt.Errorf("gallery video #%d exceeds 20MB limit", i+1)
			}
		}

		attachment := entity.Attachment{
			ID:          entity.ID(),
			ContentID:   contentID,
			Title:       item.Title,
			Description: item.Description,
			URL:         item.URL,
			Type:        item.Type,
			SortOrder:   item.SortOrder,
			IsCover:     item.IsCover,
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
func (s *Service) CreateContent(content *entity.Content, attachments []entity.CreateAttachmentArgs) error {
	content.ID = entity.ID()
	if content.Status == "" {
		content.Status = entity.ContentStatusDraft
	}

	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(content).Error; err != nil {
			return fmt.Errorf("create content: %w", err)
		}
		if len(attachments) > 0 {
			if err := s.createAttachments(tx, content.ID, content.Type, attachments); err != nil {
				return err
			}
		}
		return nil
	})
}

// UpdateContent updates content fields by ID, replacing attachments.
func (s *Service) UpdateContent(id string, args entity.UpdateContentArgs) (*entity.Content, error) {
	content, err := s.GetContentByID(id)
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
		updates["cover_url"] = *args.CoverURL
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
	}

	// Determine content type for validation
	contentType := content.Type
	if args.Type != nil {
		contentType = *args.Type
	}

	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Model(content).Updates(updates).Error; err != nil {
				return fmt.Errorf("update content: %w", err)
			}
		}

		// Replace attachments if provided (full replacement strategy)
		if args.MediaItems != nil {
			if err := tx.Where("content_id = ?", id).Delete(&entity.Attachment{}).Error; err != nil {
				return fmt.Errorf("delete old attachments: %w", err)
			}
			if len(args.MediaItems) > 0 {
				if err := s.createAttachments(tx, id, contentType, args.MediaItems); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return s.GetContentByID(id)
}

// DeleteContent deletes a content and its attachments by ID.
func (s *Service) DeleteContent(id string) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("content_id = ?", id).Delete(&entity.Attachment{}).Error; err != nil {
			return fmt.Errorf("delete attachments: %w", err)
		}
		result := tx.Where("id = ?", id).Delete(&entity.Content{})
		if result.Error != nil {
			return fmt.Errorf("delete content: %w", result.Error)
		}
		return nil
	})
}

// ImportContents imports contents from the legacy platform.
// Category is determined by each talk's "type" field: "sharing" → learning, "training" → culture
func (s *Service) ImportContents(authorID string, talks []entity.LegacyTalk) (*entity.ImportResult, error) {
	result := &entity.ImportResult{
		Total: len(talks),
	}

	for _, talk := range talks {
		if talk.Title == "" {
			result.Skipped++
			continue
		}

		var existing entity.Content
		if err := s.DB.Where("title = ?", talk.Title).First(&existing).Error; err == nil {
			result.Skipped++
			continue
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			result.Errors = append(result.Errors, fmt.Sprintf("check existing %s: %v", talk.ID, err))
			continue
		}

		var category string
		if talk.Type == "sharing" {
			category = "learning"
		} else {
			category = "culture"
		}

		createdAt := time.Now()
		if !talk.CreatedAt.IsZero() {
			createdAt = talk.CreatedAt
		}

		content := &entity.Content{
			ID:          entity.ID(),
			AuthorID:    authorID,
			Title:       talk.Title,
			Summary:     talk.Description,
			Body:        talk.Description,
			CoverURL:    talk.Cover,
			Type:        entity.ContentTypeVideo,
			Status:      entity.ContentStatusPublished,
			Category:    category,
			Tags:        talk.Tags,
			SpeakerName: talk.Speaker,
			SpeakerBio:  talk.Bio,
			CreatedAt:   createdAt,
			UpdatedAt:   createdAt,
		}

		// Create attachment for the video playback URL
		var attachments []entity.CreateAttachmentArgs
		if talk.Playback != "" {
			attachments = append(attachments, entity.CreateAttachmentArgs{
				URL:       talk.Playback,
				Type:      entity.AttachmentTypeVideo,
				SortOrder: 0,
			})
		}

		if err := s.CreateContent(content, attachments); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("create %s: %v", talk.ID, err))
			continue
		}

		result.Imported++
	}

	return result, nil
}
