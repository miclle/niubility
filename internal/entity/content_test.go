package entity

import (
	"testing"
)

func TestContent_TableName(t *testing.T) {
	c := Content{}
	if got := c.TableName(); got != "contents" {
		t.Errorf("TableName() = %q, want %q", got, "contents")
	}
}

func TestContentType_Constants(t *testing.T) {
	if ContentTypeVideo != "video" {
		t.Errorf("ContentTypeVideo = %q, want %q", ContentTypeVideo, "video")
	}
	if ContentTypeGallery != "gallery" {
		t.Errorf("ContentTypeGallery = %q, want %q", ContentTypeGallery, "gallery")
	}
	if ContentTypeArticle != "article" {
		t.Errorf("ContentTypeArticle = %q, want %q", ContentTypeArticle, "article")
	}
}

func TestContentStatus_Constants(t *testing.T) {
	if ContentStatusDraft != "draft" {
		t.Errorf("ContentStatusDraft = %q, want %q", ContentStatusDraft, "draft")
	}
	if ContentStatusPublished != "published" {
		t.Errorf("ContentStatusPublished = %q, want %q", ContentStatusPublished, "published")
	}
}

func TestSortField_Constants(t *testing.T) {
	if SortByCreatedAt != "created_at" {
		t.Errorf("SortByCreatedAt = %q, want %q", SortByCreatedAt, "created_at")
	}
	if SortByLikeCount != "like_count" {
		t.Errorf("SortByLikeCount = %q, want %q", SortByLikeCount, "like_count")
	}
}

func TestReservedSlugs(t *testing.T) {
	expected := map[string]bool{
		"videos":    true,
		"galleries": true,
		"articles":  true,
	}
	for slug, expectedValue := range expected {
		if ReservedSlugs[slug] != expectedValue {
			t.Errorf("ReservedSlugs[%q] = %v, want %v", slug, ReservedSlugs[slug], expectedValue)
		}
	}
}

func TestContent_ResolveAssetURLs(t *testing.T) {
	tests := []struct {
		name            string
		content         *Content
		wantCoverURL    string
		wantAttachments []string
	}{
		{
			name:         "nil content",
			content:      nil,
			wantCoverURL: "",
		},
		{
			name:         "empty cover URL",
			content:      &Content{CoverURL: ""},
			wantCoverURL: "",
		},
		{
			name:         "full URL unchanged",
			content:      &Content{CoverURL: "https://example.com/cover.png"},
			wantCoverURL: "https://example.com/cover.png",
		},
		{
			name:         "legacy attachment route URL normalized",
			content:      &Content{CoverURL: "https://example.com/attachments/contents/123/cover.png"},
			wantCoverURL: "/attachments/contents/123/cover.png",
		},
		{
			name:         "S3 key converted",
			content:      &Content{CoverURL: "contents/123/cover.png"},
			wantCoverURL: "/attachments/contents/123/cover.png",
		},
		{
			name: "resolves author avatar",
			content: &Content{
				Author: &User{Avatar: "users/456/avatar.png"},
			},
			wantCoverURL: "",
		},
		{
			name: "resolves speaker avatar",
			content: &Content{
				Speaker: &User{Avatar: "users/789/avatar.png"},
			},
			wantCoverURL: "",
		},
		{
			name: "resolves attachment URLs",
			content: &Content{
				Attachments: []Attachment{
					{URL: "contents/123/video.mp4", CoverURL: "contents/123/cover.png"},
				},
			},
			wantCoverURL:    "",
			wantAttachments: []string{"/attachments/contents/123/video.mp4"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.content.ResolveAssetURLs()
			if tt.content != nil {
				if tt.content.CoverURL != tt.wantCoverURL {
					t.Errorf("CoverURL = %q, want %q", tt.content.CoverURL, tt.wantCoverURL)
				}
				if tt.wantAttachments != nil {
					for i, want := range tt.wantAttachments {
						if i >= len(tt.content.Attachments) {
							t.Errorf("missing attachment %d", i)
							continue
						}
						if tt.content.Attachments[i].URL != want {
							t.Errorf("Attachments[%d].URL = %q, want %q", i, tt.content.Attachments[i].URL, want)
						}
					}
				}
			}
		})
	}
}
