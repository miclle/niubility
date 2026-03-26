package entity

import (
	"testing"
)

func TestComment_TableName(t *testing.T) {
	c := Comment{}
	if got := c.TableName(); got != "comments" {
		t.Errorf("TableName() = %q, want %q", got, "comments")
	}
}

func TestComment_ResolveAssetURLs(t *testing.T) {
	tests := []struct {
		name    string
		comment *Comment
	}{
		{
			name:    "nil comment",
			comment: nil,
		},
		{
			name:    "comment with user",
			comment: &Comment{User: &User{Avatar: "users/123/avatar.png"}},
		},
		{
			name: "comment with reply_to",
			comment: &Comment{
				ReplyTo: &Comment{User: &User{Avatar: "users/456/avatar.png"}},
			},
		},
		{
			name: "comment with replies",
			comment: &Comment{
				Replies: []Comment{
					{User: &User{Avatar: "users/789/avatar.png"}},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic
			tt.comment.ResolveAssetURLs()
		})
	}
}
