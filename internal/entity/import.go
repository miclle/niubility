package entity

import "time"

// LegacyTalk represents the data structure from the old platform.
type LegacyTalk struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Cover       string    `json:"cover"`
	StartAt     string    `json:"start_at"`
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	Speaker     string    `json:"speaker"`
	Staff       string    `json:"staff"`
	Bio         string    `json:"bio"`
	Avatar      string    `json:"avatar"`
	Broadcast   string    `json:"broadcast"`
	Playback    string    `json:"playback"`
	Type        string    `json:"type"`     // "sharing" or "training"
	Volume      string    `json:"volume"`   // e.g., "AI 赋能组织分享会"
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ImportContentsArgs represents the request body for importing contents.
type ImportContentsArgs struct {
	Contents []LegacyTalk `json:"contents" binding:"required"`
}

// ImportResult represents the result of an import operation.
type ImportResult struct {
	Total    int      `json:"total"`
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}
