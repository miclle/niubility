// Package entity defines the domain models and common utilities.
package entity

import (
	"github.com/google/uuid"
)

// ID generates a new unique identifier using UUID v4.
func ID() string {
	return uuid.New().String()
}

// Pagination represents pagination parameters for list queries.
type Pagination struct {
	Page  int   `json:"page"  form:"page"`
	Limit int   `json:"limit" form:"limit"`
	Total int64 `json:"total"`
}

// Offset returns the offset for database queries based on page and limit.
func (p *Pagination) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	return (p.Page - 1) * p.GetLimit()
}

// GetLimit returns the limit with a default value.
func (p *Pagination) GetLimit() int {
	if p.Limit <= 0 {
		p.Limit = 20
	}
	if p.Limit > 100 {
		p.Limit = 100
	}
	return p.Limit
}
