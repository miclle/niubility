package service

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// ListCategories retrieves all categories ordered by sort_order ascending.
// If visibleOnly is true, only visible categories are returned.
func (s *Service) ListCategories(visibleOnly bool) ([]entity.Category, error) {
	var categories []entity.Category
	query := s.DB.Order("sort_order ASC, created_at ASC")
	if visibleOnly {
		query = query.Where("visible = ?", true)
	}
	if err := query.Find(&categories).Error; err != nil {
		return nil, fmt.Errorf("list categories: %w", err)
	}
	return categories, nil
}

// GetCategoryContentCounts returns a map of category slug to content count.
func (s *Service) GetCategoryContentCounts() (map[string]int64, error) {
	type result struct {
		Category string
		Count    int64
	}
	var results []result
	if err := s.DB.Model(&entity.Content{}).
		Select("category, count(*) as count").
		Group("category").
		Find(&results).Error; err != nil {
		return nil, fmt.Errorf("get category content counts: %w", err)
	}
	counts := make(map[string]int64, len(results))
	for _, r := range results {
		counts[r.Category] = r.Count
	}
	return counts, nil
}

// GetCategoryBySlug retrieves a category by its slug.
func (s *Service) GetCategoryBySlug(slug string) (*entity.Category, error) {
	var category entity.Category
	if err := s.DB.Where("slug = ?", slug).First(&category).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get category by slug: %w", err)
	}
	return &category, nil
}

// GetCategoryByID retrieves a category by its ID.
func (s *Service) GetCategoryByID(id string) (*entity.Category, error) {
	var category entity.Category
	if err := s.DB.Where("id = ?", id).First(&category).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get category by id: %w", err)
	}
	return &category, nil
}

// CreateCategory creates a new category record.
func (s *Service) CreateCategory(category *entity.Category) error {
	category.ID = entity.ID()
	if err := s.DB.Create(category).Error; err != nil {
		return fmt.Errorf("create category: %w", err)
	}
	return nil
}

// UpdateCategory updates category fields by ID.
func (s *Service) UpdateCategory(id string, args entity.UpdateCategoryArgs) (*entity.Category, error) {
	category, err := s.GetCategoryByID(id)
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
		if err := s.DB.Model(category).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("update category: %w", err)
		}
	}

	return s.GetCategoryByID(id)
}

// ReorderCategories updates sort_order for multiple categories in a single transaction.
func (s *Service) ReorderCategories(items []entity.ReorderCategoryItem) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			if err := tx.Model(&entity.Category{}).Where("id = ?", item.ID).Update("sort_order", item.SortOrder).Error; err != nil {
				return fmt.Errorf("reorder category %s: %w", item.ID, err)
			}
		}
		return nil
	})
}

// DeleteCategory deletes a category by ID.
// Returns an error if there are contents using this category.
func (s *Service) DeleteCategory(id string) error {
	category, err := s.GetCategoryByID(id)
	if err != nil {
		return err
	}
	if category == nil {
		return nil
	}

	// Check if any contents use this category
	var count int64
	if err := s.DB.Model(&entity.Content{}).Where("category = ?", category.Slug).Count(&count).Error; err != nil {
		return fmt.Errorf("count contents for category: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("cannot delete category: %d contents are using this category", count)
	}

	if err := s.DB.Where("id = ?", id).Delete(&entity.Category{}).Error; err != nil {
		return fmt.Errorf("delete category: %w", err)
	}
	return nil
}

// seedCategories inserts default categories if the categories table is empty.
func (s *Service) seedCategories() error {
	var count int64
	if err := s.DB.Model(&entity.Category{}).Count(&count).Error; err != nil {
		return fmt.Errorf("count categories: %w", err)
	}
	if count > 0 {
		return nil
	}

	defaults := []entity.Category{
		{ID: entity.ID(), Name: "学习交流", Slug: "learning", Icon: "Home", Visible: true, SortOrder: 1},
		{ID: entity.ID(), Name: "企业文化", Slug: "culture", Icon: "Play", Visible: true, SortOrder: 2},
	}

	for _, cat := range defaults {
		if err := s.DB.Create(&cat).Error; err != nil {
			return fmt.Errorf("seed category %s: %w", cat.Slug, err)
		}
	}

	fmt.Println("[Service] Default categories seeded")
	return nil
}
