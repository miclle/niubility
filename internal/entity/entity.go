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

// Pagination represents cursor-based pagination request parameters.
// This struct is used for form binding only; responses use flat fields (items, next_cursor, total).
type Pagination struct {
	Limit  int    `form:"limit"`
	Cursor string `form:"cursor"`
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
