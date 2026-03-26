package entity

import (
	"testing"
)

func TestLike_TableName(t *testing.T) {
	l := Like{}
	if got := l.TableName(); got != "likes" {
		t.Errorf("TableName() = %q, want %q", got, "likes")
	}
}

func TestTargetType_Constants(t *testing.T) {
	if TargetTypeContent != "content" {
		t.Errorf("TargetTypeContent = %q, want %q", TargetTypeContent, "content")
	}
	if TargetTypeComment != "comment" {
		t.Errorf("TargetTypeComment = %q, want %q", TargetTypeComment, "comment")
	}
	if TargetTypeAttachment != "attachment" {
		t.Errorf("TargetTypeAttachment = %q, want %q", TargetTypeAttachment, "attachment")
	}
}
