package entity

import (
	"testing"
)

func TestAvatarURL(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{"empty key", "", ""},
		{"full URL unchanged", "https://example.com/avatar.png", "https://example.com/avatar.png"},
		{"http URL unchanged", "http://example.com/avatar.png", "http://example.com/avatar.png"},
		{"absolute path unchanged", "/static/avatar.png", "/static/avatar.png"},
		{"S3 key converted", "users/123/avatar.png", "/avatars/users/123/avatar.png"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AvatarURL(tt.key); got != tt.want {
				t.Errorf("AvatarURL(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}
}

func TestAttachmentURL(t *testing.T) {
	tests := []struct {
		name string
		key  string
		want string
	}{
		{"empty key", "", ""},
		{"full URL unchanged", "https://example.com/file.mp4", "https://example.com/file.mp4"},
		{"http URL unchanged", "http://example.com/file.mp4", "http://example.com/file.mp4"},
		{"absolute path unchanged", "/static/file.mp4", "/static/file.mp4"},
		{"S3 key converted", "contents/123/file.mp4", "/attachments/contents/123/file.mp4"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AttachmentURL(tt.key); got != tt.want {
				t.Errorf("AttachmentURL(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}
}
