package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// GalleryVideoMaxFileSize is the maximum file size for videos in gallery content (200 MB).
const GalleryVideoMaxFileSize int64 = 200 * 1024 * 1024

// ListContents retrieves a paginated list of contents with optional filters using cursor-based pagination.
func (s *Service) ListContents(args entity.ListContentsArgs) ([]entity.Content, string, error) {
	var contents []entity.Content

	query := s.DB.Model(&entity.Content{})

	if args.Category != "" {
		query = query.Where("category = ?", args.Category)
	}
	if args.Type != "" {
		query = query.Where("type = ?", args.Type)
	}
	if args.Keyword != "" {
		keyword := "%" + args.Keyword + "%"
		query = s.whereLike(query, []string{"title", "summary"}, keyword)
	}
	if args.Tag != "" {
		query = s.whereJSONContains(query, "tags", fmt.Sprintf(`[%q]`, args.Tag))
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

	// Determine sort mode
	sortByLikes := args.Sort == entity.SortByLikeCount

	// Apply cursor-based pagination if cursor is provided
	if args.Cursor != "" {
		if sortByLikes {
			// cursor format: like_count|created_at|id
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
			query = query.Where(
				"(like_count, created_at, id) < (?, ?, ?)",
				likeCount, cursorTime, cursorID,
			)
		} else {
			// cursor format: created_at|id
			parts, err := entity.DecodeCursor(args.Cursor, 2)
			if err != nil {
				return nil, "", fmt.Errorf("decode cursor: %w", err)
			}
			cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
			if err != nil {
				return nil, "", fmt.Errorf("parse cursor created_at: %w", err)
			}
			cursorID := parts[1]
			query = query.Where(
				"(created_at, id) < (?, ?)",
				cursorTime, cursorID,
			)
		}
	}

	// sorting — always include id as tie-breaker for stable cursor pagination
	orderClause := "created_at DESC, id DESC"
	if sortByLikes {
		orderClause = "like_count DESC, created_at DESC, id DESC"
	}

	if err := query.Preload("Author").Preload("Speaker").Preload("Attachments", func(db *gorm.DB) *gorm.DB {
		return db.Order("sort_order ASC")
	}).Limit(args.GetLimit()).Order(orderClause).Find(&contents).Error; err != nil {
		return nil, "", fmt.Errorf("list contents: %w", err)
	}

	// Build next_cursor from the last item
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
		if args.Attachments != nil {
			if err := tx.Where("content_id = ?", id).Delete(&entity.Attachment{}).Error; err != nil {
				return fmt.Errorf("delete old attachments: %w", err)
			}
			if len(args.Attachments) > 0 {
				if err := s.createAttachments(tx, id, contentType, args.Attachments); err != nil {
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
