// Package api provides API types tests
package api

import (
	"encoding/json"
	"testing"
)

func TestPresignRequestJSON(t *testing.T) {
	// Test that PresignRequest uses content_type field
	req := PresignRequest{
		Filename:    "test.png",
		ContentType: "image/png",
	}

	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("failed to marshal: %v", err)
	}

	var unmarshaled map[string]interface{}
	if err := json.Unmarshal(data, &unmarshaled); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	// Verify content_type field is present (not type)
	if _, ok := unmarshaled["type"]; ok {
		t.Error("expected 'content_type' field, got 'type'")
	}
	if ct, ok := unmarshaled["content_type"]; !ok {
		t.Error("missing 'content_type' field")
	} else if ct != "image/png" {
		t.Errorf("expected content_type 'image/png', got %v", ct)
	}
}

func TestCategoryListResponseJSON(t *testing.T) {
	// Test that CategoryListResponse uses categories field
	jsonData := `{"categories":[{"id":"1","name":"Learning","slug":"learning","content_count":10}]}`

	var resp CategoryListResponse
	if err := json.Unmarshal([]byte(jsonData), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(resp.Categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(resp.Categories))
	}

	cat := resp.Categories[0]
	if cat.ContentCount != 10 {
		t.Errorf("expected content_count 10, got %d", cat.ContentCount)
	}
}

func TestContentListResponseJSON(t *testing.T) {
	// Test that ContentListResponse uses items field
	jsonData := `{"items":[{"id":"1","title":"Test","type":"article"}],"next_cursor":"abc123"}`

	var resp ContentListResponse
	if err := json.Unmarshal([]byte(jsonData), &resp); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if len(resp.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(resp.Items))
	}

	if resp.Items[0].Title != "Test" {
		t.Errorf("expected title 'Test', got %s", resp.Items[0].Title)
	}

	if resp.NextCursor != "abc123" {
		t.Errorf("expected next_cursor 'abc123', got %s", resp.NextCursor)
	}

	// Test HasMore method
	if !resp.HasMore() {
		t.Error("expected HasMore() to return true when next_cursor is set")
	}

	// Test HasMore with empty cursor
	jsonDataNoMore := `{"items":[{"id":"1","title":"Test","type":"article"}]}`
	var respNoMore ContentListResponse
	if err := json.Unmarshal([]byte(jsonDataNoMore), &respNoMore); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if respNoMore.HasMore() {
		t.Error("expected HasMore() to return false when next_cursor is empty")
	}
}

func TestBootResponseIsAuthenticated(t *testing.T) {
	tests := []struct {
		auth         string
		expectAuthed bool
	}{
		{"authorized", true},
		{"unauthorized", false},
		{"", false},
	}

	for _, tt := range tests {
		boot := &BootResponse{Authentication: tt.auth}
		if boot.IsAuthenticated() != tt.expectAuthed {
		t.Errorf("IsAuthenticated() for auth=%q: expected %v, got %v",
			tt.auth, tt.expectAuthed, boot.IsAuthenticated())
		}
	}
}
