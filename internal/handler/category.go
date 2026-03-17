package handler

import (
	"net/http"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// CategoryWithCount extends Category with the content count for that category.
type CategoryWithCount struct {
	entity.Category
	ContentCount int64 `json:"content_count"`
}

// ListCategoriesResponse represents the response for listing categories.
type ListCategoriesResponse struct {
	Categories []CategoryWithCount `json:"categories"`
}

// ListCategories returns all categories ordered by sort_order (public, visible only).
func (ctrl *Ctrl) ListCategories(c *fox.Context) (*ListCategoriesResponse, error) {
	categories, err := ctrl.service.ListCategories(true)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	counts, _ := ctrl.service.GetCategoryContentCounts()
	items := make([]CategoryWithCount, len(categories))
	for i, cat := range categories {
		items[i] = CategoryWithCount{Category: cat, ContentCount: counts[cat.Slug]}
	}
	return &ListCategoriesResponse{Categories: items}, nil
}

// ListAllCategories returns all categories including hidden ones (admin only).
func (ctrl *Ctrl) ListAllCategories(c *fox.Context) (*ListCategoriesResponse, error) {
	categories, err := ctrl.service.ListCategories(false)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	counts, _ := ctrl.service.GetCategoryContentCounts()
	items := make([]CategoryWithCount, len(categories))
	for i, cat := range categories {
		items[i] = CategoryWithCount{Category: cat, ContentCount: counts[cat.Slug]}
	}
	return &ListCategoriesResponse{Categories: items}, nil
}

// CreateCategoryArgs represents the fields required to create a category.
type CreateCategoryArgs struct {
	Name      string `json:"name"       binding:"required"`
	Slug      string `json:"slug"       binding:"required"`
	Icon      string `json:"icon"`
	SortOrder int    `json:"sort_order"`
}

// CreateCategory creates a new category (admin only).
func (ctrl *Ctrl) CreateCategory(c *fox.Context, args CreateCategoryArgs) (*entity.Category, error) {
	category := &entity.Category{
		Name:      args.Name,
		Slug:      args.Slug,
		Icon:      args.Icon,
		Visible:   true,
		SortOrder: args.SortOrder,
	}

	if err := ctrl.service.CreateCategory(category); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return category, nil
}

// UpdateCategory updates an existing category (admin only).
func (ctrl *Ctrl) UpdateCategory(c *fox.Context, args entity.UpdateCategoryArgs) (*entity.Category, error) {
	id := c.Param("id")

	category, err := ctrl.service.UpdateCategory(id, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if category == nil {
		return nil, httperrors.ErrNotFound
	}

	return category, nil
}

// ReorderCategoriesArgs represents the request body for reordering categories.
type ReorderCategoriesArgs struct {
	Items []entity.ReorderCategoryItem `json:"items" binding:"required"`
}

// ReorderCategories updates sort_order for multiple categories (admin only).
func (ctrl *Ctrl) ReorderCategories(c *fox.Context, args ReorderCategoriesArgs) (*ListCategoriesResponse, error) {
	if err := ctrl.service.ReorderCategories(args.Items); err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	// Return updated list
	return ctrl.ListAllCategories(c)
}

// DeleteCategory deletes a category by ID (admin only).
// Returns an error if contents are using this category.
func (ctrl *Ctrl) DeleteCategory(c *fox.Context) error {
	id := c.Param("id")

	if err := ctrl.service.DeleteCategory(id); err != nil {
		return httperrors.New(http.StatusConflict, err.Error())
	}

	c.Status(http.StatusNoContent)
	return nil
}
