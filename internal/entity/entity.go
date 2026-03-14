// Package entity defines the domain models and common utilities.
package entity

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ID generates a new unique identifier using MongoDB ObjectID hex string.
func ID() string {
	return primitive.NewObjectID().Hex()
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
