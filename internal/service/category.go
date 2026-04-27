package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ErrCategoryHasContents indicates a category cannot be deleted because contents are using it.
var ErrCategoryHasContents = errors.New("category has associated contents")

// ListCategories retrieves all categories ordered by sort_order ascending.
// If visibleOnly is true, only visible categories are returned.
func (s *Service) ListCategories(ctx context.Context, visibleOnly bool) ([]entity.Category, error) {
	log := logger.NewWithContext(ctx)

	var categories []entity.Category
	query := s.db.WithContext(ctx).Order("sort_order ASC, created_at ASC")
	if visibleOnly {
		query = query.Where("visible = ?", true)
	}
	if err := query.Find(&categories).Error; err != nil {
		log.Errorf("ListCategories: %v", err)
		return nil, fmt.Errorf("list categories: %w", err)
	}
	return categories, nil
}

// GetCategoryContentCounts returns a map of category slug to content count.
// When publicOnly is true, only publicly listable contents are included.
func (s *Service) GetCategoryContentCounts(ctx context.Context, publicOnly bool) (map[string]int64, error) {
	log := logger.NewWithContext(ctx)

	type result struct {
		Category string
		Count    int64
	}
	var results []result
	query := s.db.WithContext(ctx).Model(&entity.Content{}).
		Select("category, count(*) as count")
	if publicOnly {
		query = query.Scopes(scopePublicListVisible)
	}
	if err := query.
		Group("category").
		Find(&results).Error; err != nil {
		log.Errorf("GetCategoryContentCounts: %v", err)
		return nil, fmt.Errorf("get category content counts: %w", err)
	}
	counts := make(map[string]int64, len(results))
	for _, r := range results {
		counts[r.Category] = r.Count
	}
	return counts, nil
}

// GetCategoryByID retrieves a category by its ID.
func (s *Service) GetCategoryByID(ctx context.Context, id string) (*entity.Category, error) {
	log := logger.NewWithContext(ctx)

	var category entity.Category
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&category).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("GetCategoryByID: %v", err)
		return nil, fmt.Errorf("get category by id: %w", err)
	}
	return &category, nil
}

// CreateCategory creates a new category record.
func (s *Service) CreateCategory(ctx context.Context, category *entity.Category) error {
	log := logger.NewWithContext(ctx)

	if entity.ReservedSlugs[category.Slug] {
		return fmt.Errorf("slug %q is reserved for content type routes", category.Slug)
	}

	category.ID = entity.ID()
	if err := s.db.WithContext(ctx).Create(category).Error; err != nil {
		log.Errorf("CreateCategory: %v", err)
		return fmt.Errorf("create category: %w", err)
	}
	return nil
}

// UpdateCategory updates category fields by ID.
func (s *Service) UpdateCategory(ctx context.Context, id string, args entity.UpdateCategoryArgs) (*entity.Category, error) {
	log := logger.NewWithContext(ctx)

	category, err := s.GetCategoryByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if category == nil {
		return nil, nil
	}

	updates := map[string]any{}
	if args.Name != nil {
		updates["name"] = *args.Name
	}
	if args.Slug != nil {
		if entity.ReservedSlugs[*args.Slug] {
			return nil, fmt.Errorf("slug %q is reserved for content type routes", *args.Slug)
		}
		updates["slug"] = *args.Slug
	}
	if args.Icon != nil {
		updates["icon"] = *args.Icon
	}
	if args.Visible != nil {
		updates["visible"] = *args.Visible
	}
	if args.SortOrder != nil {
		updates["sort_order"] = *args.SortOrder
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(category).Updates(updates).Error; err != nil {
			log.Errorf("UpdateCategory: %v", err)
			return nil, fmt.Errorf("update category: %w", err)
		}
	}

	return s.GetCategoryByID(ctx, id)
}

// ReorderCategories updates sort_order for multiple categories in a single transaction.
func (s *Service) ReorderCategories(ctx context.Context, items []entity.ReorderCategoryItem) error {
	log := logger.NewWithContext(ctx)

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			if err := tx.Model(&entity.Category{}).Where("id = ?", item.ID).Update("sort_order", item.SortOrder).Error; err != nil {
				log.Errorf("ReorderCategories: %v", err)
				return fmt.Errorf("reorder category %s: %w", item.ID, err)
			}
		}
		return nil
	})
}

// DeleteCategory deletes a category by ID.
// Returns an error if there are contents using this category.
func (s *Service) DeleteCategory(ctx context.Context, id string) error {
	log := logger.NewWithContext(ctx)

	category, err := s.GetCategoryByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get category: %w", err)
	}
	if category == nil {
		return nil
	}

	// Check if any contents use this category
	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).Where("category = ?", category.Slug).Count(&count).Error; err != nil {
		log.Errorf("DeleteCategory: count contents: %v", err)
		return fmt.Errorf("count contents for category: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("%w: %d contents are using this category", ErrCategoryHasContents, count)
	}

	if err := s.db.WithContext(ctx).Where("id = ?", id).Delete(&entity.Category{}).Error; err != nil {
		log.Errorf("DeleteCategory: %v", err)
		return fmt.Errorf("delete category: %w", err)
	}
	return nil
}
