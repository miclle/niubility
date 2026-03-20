package service

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

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

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count contents: %w", err)
	}

	// sorting
	orderClause := "created_at DESC"
	if args.Sort == entity.SortByLikeCount {
		orderClause = "like_count DESC"
	}

	if err := query.Preload("Author").Preload("Speaker").Offset(args.Offset()).Limit(args.GetLimit()).Order(orderClause).Find(&contents).Error; err != nil {
		return nil, 0, fmt.Errorf("list contents: %w", err)
	}

	return contents, total, nil
}

// GetContentByID retrieves a content by ID with author preloaded.
func (s *Service) GetContentByID(id string) (*entity.Content, error) {
	var content entity.Content
	if err := s.DB.Preload("Author").Preload("Speaker").Where("id = ?", id).First(&content).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get content by id: %w", err)
	}
	return &content, nil
}

// CreateContent creates a new content record.
func (s *Service) CreateContent(content *entity.Content) error {
	content.ID = entity.ID()
	if err := s.DB.Create(content).Error; err != nil {
		return fmt.Errorf("create content: %w", err)
	}
	return nil
}

// UpdateContent updates content fields by ID.
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
	if args.VideoURL != nil {
		updates["video_url"] = *args.VideoURL
	}
	if args.Type != nil {
		updates["type"] = *args.Type
	}
	if args.Category != nil {
		updates["category"] = *args.Category
	}
	if args.Tags != nil {
		updates["tags"] = args.Tags
	}
	if args.SpeakerID != nil {
		updates["speaker_id"] = *args.SpeakerID
		// When setting a speaker from employees, clear manual speaker name
		if *args.SpeakerID != "" {
			updates["speaker_name"] = ""
		}
	}
	if args.SpeakerName != nil {
		updates["speaker_name"] = *args.SpeakerName
		// When setting manual speaker, clear employee speaker
		if *args.SpeakerName != "" {
			updates["speaker_id"] = ""
		}
	}
	if args.SpeakerBio != nil {
		updates["speaker_bio"] = *args.SpeakerBio
	}

	if len(updates) > 0 {
		if err := s.DB.Model(content).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("update content: %w", err)
		}
	}

	// reload with author
	return s.GetContentByID(id)
}

// DeleteContent deletes a content by ID.
func (s *Service) DeleteContent(id string) error {
	result := s.DB.Where("id = ?", id).Delete(&entity.Content{})
	if result.Error != nil {
		return fmt.Errorf("delete content: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil
	}
	return nil
}

// ImportContents imports contents from the legacy platform.
// Category is determined by each talk's "type" field: "sharing" → learning, "training" → culture
func (s *Service) ImportContents(authorID string, talks []entity.LegacyTalk) (*entity.ImportResult, error) {
	result := &entity.ImportResult{
		Total: len(talks),
	}

	for _, talk := range talks {
		// Skip if title is empty
		if talk.Title == "" {
			result.Skipped++
			continue
		}

		// Check if content with this title already exists
		var existing entity.Content
		if err := s.DB.Where("title = ?", talk.Title).First(&existing).Error; err == nil {
			result.Skipped++
			continue
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			result.Errors = append(result.Errors, fmt.Sprintf("check existing %s: %v", talk.ID, err))
			continue
		}

		// Determine category from talk.Type: "sharing" → learning, "training" → culture
		var category string
		if talk.Type == "sharing" {
			category = "learning"
		} else {
			category = "culture"
		}

		// Parse created_at time
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
			VideoURL:    talk.Playback,
			Type:        entity.ContentTypeVideo,
			Category:    category,
			Tags:        talk.Tags,
			SpeakerName: talk.Speaker,
			SpeakerBio:  talk.Bio,
			CreatedAt:   createdAt,
			UpdatedAt:   createdAt,
		}

		if err := s.DB.Create(content).Error; err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("create %s: %v", talk.ID, err))
			continue
		}

		result.Imported++
	}

	return result, nil
}
