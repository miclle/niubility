package service

import (
	"errors"
	"fmt"

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

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count contents: %w", err)
	}

	// sorting
	orderClause := "created_at DESC"
	if args.Sort == entity.SortByLikeCount {
		orderClause = "like_count DESC"
	}

	if err := query.Preload("Author").Offset(args.Offset()).Limit(args.GetLimit()).Order(orderClause).Find(&contents).Error; err != nil {
		return nil, 0, fmt.Errorf("list contents: %w", err)
	}

	return contents, total, nil
}

// GetContentByID retrieves a content by ID with author preloaded.
func (s *Service) GetContentByID(id string) (*entity.Content, error) {
	var content entity.Content
	if err := s.DB.Preload("Author").Where("id = ?", id).First(&content).Error; err != nil {
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
	if args.Speaker != nil {
		updates["speaker"] = *args.Speaker
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
