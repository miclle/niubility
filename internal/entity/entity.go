// Package entity defines the domain models and common utilities.
package entity

import (
	"encoding/base64"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// ID generates a new unique identifier using UUID v4.
func ID() string {
	return uuid.New().String()
}

// Pagination represents pagination parameters for list queries.
type Pagination struct {
	Page       int    `json:"page"                  form:"page"`
	Limit      int    `json:"limit"                 form:"limit"`
	Total      int64  `json:"total"`
	Cursor     string `json:"cursor,omitempty"       form:"cursor"`
	NextCursor string `json:"next_cursor,omitempty"`
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

// EncodeCursor encodes cursor fields into an opaque base64 string.
// Fields are joined with "|" then base64-encoded.
func EncodeCursor(fields ...string) string {
	return base64.StdEncoding.EncodeToString([]byte(strings.Join(fields, "|")))
}

// DecodeCursor decodes a base64 cursor string into its component fields.
func DecodeCursor(cursor string, count int) ([]string, error) {
	data, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return nil, fmt.Errorf("decode cursor: %w", err)
	}
	parts := strings.SplitN(string(data), "|", count)
	if len(parts) != count {
		return nil, fmt.Errorf("invalid cursor: expected %d fields, got %d", count, len(parts))
	}
	return parts, nil
}
