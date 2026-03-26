package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

// Note: ToggleFavorite tests are skipped for SQLite because SQLite doesn't support GREATEST function.
// The ToggleFavorite functionality should be tested with PostgreSQL or MySQL in integration tests.

func TestService_IsFavorited(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author and content
	user := &entity.User{ID: entity.ID(), Username: "isfavoriteduser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Test", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Should not be favorited initially
	favorited, err := s.IsFavorited(ctx, user.ID, content.ID)
	if err != nil {
		t.Fatalf("IsFavorited() error = %v", err)
	}
	if favorited {
		t.Error("IsFavorited() = true, want false")
	}

	// Create favorite directly (bypass ToggleFavorite which uses GREATEST)
	fav := &entity.Favorite{
		ID:        entity.ID(),
		UserID:    user.ID,
		ContentID: content.ID,
	}
	if err := s.db.Create(fav).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}

	// Should be favorited now
	favorited, err = s.IsFavorited(ctx, user.ID, content.ID)
	if err != nil {
		t.Fatalf("IsFavorited() error = %v", err)
	}
	if !favorited {
		t.Error("IsFavorited() = false, want true")
	}
}

func TestService_GetFavoritedIDs(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{ID: entity.ID(), Username: "getfavoritedidsuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
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

	// Create favorites directly (bypass ToggleFavorite which uses GREATEST)
	fav1 := &entity.Favorite{ID: entity.ID(), UserID: user.ID, ContentID: content1.ID}
	fav3 := &entity.Favorite{ID: entity.ID(), UserID: user.ID, ContentID: content3.ID}
	if err := s.db.Create(fav1).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}
	if err := s.db.Create(fav3).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}

	// Get favorited IDs
	ids, err := s.GetFavoritedIDs(ctx, user.ID, []string{content1.ID, content2.ID, content3.ID})
	if err != nil {
		t.Fatalf("GetFavoritedIDs() error = %v", err)
	}
	if len(ids) != 2 {
		t.Errorf("len(ids) = %d, want 2", len(ids))
	}

	// Test with empty input
	ids, err = s.GetFavoritedIDs(ctx, user.ID, []string{})
	if err != nil {
		t.Fatalf("GetFavoritedIDs() error = %v", err)
	}
	if ids != nil {
		t.Errorf("GetFavoritedIDs() = %v, want nil", ids)
	}
}

func TestService_ListFavorites(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{ID: entity.ID(), Username: "listfavoritesuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents
	content1 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Fav 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	content2 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Fav 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content1).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}
	if err := s.db.Create(content2).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Create favorites directly (bypass ToggleFavorite which uses GREATEST)
	fav1 := &entity.Favorite{ID: entity.ID(), UserID: user.ID, ContentID: content1.ID}
	fav2 := &entity.Favorite{ID: entity.ID(), UserID: user.ID, ContentID: content2.ID}
	if err := s.db.Create(fav1).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}
	if err := s.db.Create(fav2).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}

	// List favorites
	contents, _, err := s.ListFavorites(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListFavorites() error = %v", err)
	}
	if len(contents) != 2 {
		t.Errorf("len(contents) = %d, want 2", len(contents))
	}
}
