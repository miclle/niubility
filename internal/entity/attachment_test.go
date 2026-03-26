package entity

import (
	"testing"
)

func TestAttachment_TableName(t *testing.T) {
	a := Attachment{}
	if got := a.TableName(); got != "attachments" {
		t.Errorf("TableName() = %q, want %q", got, "attachments")
	}
}

func TestAttachmentType_Constants(t *testing.T) {
	if AttachmentTypeVideo != "video" {
		t.Errorf("AttachmentTypeVideo = %q, want %q", AttachmentTypeVideo, "video")
	}
	if AttachmentTypeImage != "image" {
		t.Errorf("AttachmentTypeImage = %q, want %q", AttachmentTypeImage, "image")
	}
	if AttachmentTypeDocument != "document" {
		t.Errorf("AttachmentTypeDocument = %q, want %q", AttachmentTypeDocument, "document")
	}
}
