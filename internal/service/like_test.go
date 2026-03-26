package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

// Note: ToggleLike tests are skipped for SQLite because SQLite doesn't support GREATEST function.
// The ToggleLike functionality should be tested with PostgreSQL or MySQL in integration tests.

func TestService_IsLiked(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author and content
	user := &entity.User{ID: entity.ID(), Username: "islikeduser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Should not be liked initially
	liked, err := s.IsLiked(ctx, user.ID, content.ID, entity.TargetTypeContent)
	if err != nil {
		t.Fatalf("IsLiked() error = %v", err)
	}
	if liked {
		t.Error("IsLiked() = true, want false")
	}

	// Create like directly (bypass ToggleLike which uses GREATEST)
	like := &entity.Like{
		ID:         entity.ID(),
		UserID:     user.ID,
		TargetID:   content.ID,
		TargetType: entity.TargetTypeContent,
	}
	if err := s.db.Create(like).Error; err != nil {
		t.Fatalf("Failed to create like: %v", err)
	}

	// Should be liked now
	liked, err = s.IsLiked(ctx, user.ID, content.ID, entity.TargetTypeContent)
	if err != nil {
		t.Fatalf("IsLiked() error = %v", err)
	}
	if !liked {
		t.Error("IsLiked() = false, want true")
	}
}

func TestService_GetLikedIDs(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{ID: entity.ID(), Username: "getlikedidsuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents
	content1 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	content2 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	content3 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test 3", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content1).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}
	if err := s.db.Create(content2).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}
	if err := s.db.Create(content3).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Create likes directly (bypass ToggleLike which uses GREATEST)
	like1 := &entity.Like{ID: entity.ID(), UserID: user.ID, TargetID: content1.ID, TargetType: entity.TargetTypeContent}
	like3 := &entity.Like{ID: entity.ID(), UserID: user.ID, TargetID: content3.ID, TargetType: entity.TargetTypeContent}
	if err := s.db.Create(like1).Error; err != nil {
		t.Fatalf("Failed to create like: %v", err)
	}
	if err := s.db.Create(like3).Error; err != nil {
		t.Fatalf("Failed to create like: %v", err)
	}

	// Get liked IDs
	ids, err := s.GetLikedIDs(ctx, user.ID, []string{content1.ID, content2.ID, content3.ID}, entity.TargetTypeContent)
	if err != nil {
		t.Fatalf("GetLikedIDs() error = %v", err)
	}
	if len(ids) != 2 {
		t.Errorf("len(ids) = %d, want 2", len(ids))
	}

	// Test with empty input
	ids, err = s.GetLikedIDs(ctx, user.ID, []string{}, entity.TargetTypeContent)
	if err != nil {
		t.Fatalf("GetLikedIDs() error = %v", err)
	}
	if ids != nil {
		t.Errorf("GetLikedIDs() = %v, want nil", ids)
	}
}
