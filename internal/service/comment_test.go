package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_CreateComment(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author and content
	user := &entity.User{ID: entity.ID(), Username: "commentauthor", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	comment := &entity.Comment{
		ContentID: content.ID,
		UserID:    user.ID,
		Body:      "Test comment",
	}

	if err := s.CreateComment(ctx, comment); err != nil {
		t.Fatalf("CreateComment() error = %v", err)
	}

	if comment.ID == "" {
		t.Error("CreateComment() should set comment.ID")
	}

	// Verify comment_count was incremented
	updated, _ := s.GetContentByID(ctx, content.ID)
	if updated.CommentCount != 1 {
		t.Errorf("CommentCount = %d, want 1", updated.CommentCount)
	}
}

func TestService_GetCommentByID(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author and content
	user := &entity.User{ID: entity.ID(), Username: "getcommentauthor", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Create comment
	comment := &entity.Comment{
		ID:        entity.ID(),
		ContentID: content.ID,
		UserID:    user.ID,
		Body:      "Test comment",
	}
	if err := s.db.Create(comment).Error; err != nil {
		t.Fatalf("Failed to create test comment: %v", err)
	}

	// Test getting existing comment
	got, err := s.GetCommentByID(ctx, comment.ID)
	if err != nil {
		t.Fatalf("GetCommentByID() error = %v", err)
	}
	if got == nil {
		t.Fatal("GetCommentByID() returned nil")
		return
	}
	if got.ID != comment.ID {
		t.Errorf("ID = %q, want %q", got.ID, comment.ID)
	}

	// Test getting non-existent comment
	got, err = s.GetCommentByID(ctx, "nonexistent-id")
	if err != nil {
		t.Fatalf("GetCommentByID() error = %v", err)
	}
	if got != nil {
		t.Errorf("GetCommentByID() = %v, want nil", got)
	}
}

func TestService_ListComments(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author and content
	user := &entity.User{ID: entity.ID(), Username: "listcommentauthor", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Create comments
	comments := []*entity.Comment{
		{ID: entity.ID(), ContentID: content.ID, UserID: user.ID, Body: "Comment 1", ParentID: ""},
		{ID: entity.ID(), ContentID: content.ID, UserID: user.ID, Body: "Comment 2", ParentID: ""},
	}
	for _, c := range comments {
		if err := s.db.Create(c).Error; err != nil {
			t.Fatalf("Failed to create test comment: %v", err)
		}
	}

	// List comments
	got, total, _, err := s.ListComments(ctx, content.ID, "", entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListComments() error = %v", err)
	}
	if total != 2 {
		t.Errorf("total = %d, want 2", total)
	}
	if len(got) != 2 {
		t.Errorf("len(got) = %d, want 2", len(got))
	}
}
