package entity

import "time"

// Category represents a content category stored in the database.
type Category struct {
	ID        string    `json:"id"         gorm:"column:id;primaryKey;size:36"`
	Name      string    `json:"name"       gorm:"column:name"`
	Slug      string    `json:"slug"       gorm:"column:slug;size:64;uniqueIndex:uniq_categories_slug"`
	Icon      string    `json:"icon"       gorm:"column:icon"`
	Visible   bool      `json:"visible"    gorm:"column:visible;default:true"`
	SortOrder int       `json:"sort_order" gorm:"column:sort_order;default:0"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TableName specifies the database table name for Category.
func (Category) TableName() string {
	return "categories"
}

// UpdateCategoryArgs represents the fields that can be updated for a category.
type UpdateCategoryArgs struct {
	Name      *string `json:"name"`
	Slug      *string `json:"slug"`
	Icon      *string `json:"icon"`
	Visible   *bool   `json:"visible"`
	SortOrder *int    `json:"sort_order"`
}

// ReorderCategoryItem represents a single item in a reorder request.
type ReorderCategoryItem struct {
	ID        string `json:"id"         binding:"required"`
	SortOrder int    `json:"sort_order"`
}
