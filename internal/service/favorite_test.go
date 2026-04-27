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

func TestService_ListFavorites(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{ID: entity.ID(), Username: "listfavoritesuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents
	content1 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Fav 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
	content2 := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Fav 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
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

func TestService_ListFavorites_UsesDetailVisibility(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "listfavoritesvisibility", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	publicContent := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Public", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
	unlistedContent := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Unlisted", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityUnlisted}
	blockedContent := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Blocked", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityBlocked}
	for _, content := range []*entity.Content{publicContent, unlistedContent, blockedContent} {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}
	for _, favorite := range []*entity.Favorite{
		{ID: entity.ID(), UserID: user.ID, ContentID: publicContent.ID},
		{ID: entity.ID(), UserID: user.ID, ContentID: unlistedContent.ID},
		{ID: entity.ID(), UserID: user.ID, ContentID: blockedContent.ID},
	} {
		if err := s.db.Create(favorite).Error; err != nil {
			t.Fatalf("Failed to create favorite: %v", err)
		}
	}

	contents, _, err := s.ListFavorites(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListFavorites() error = %v", err)
	}
	if len(contents) != 2 {
		t.Fatalf("len(contents) = %d, want 2", len(contents))
	}
}

func TestService_ListUserPublicFavorites_UsesListVisibility(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "publicfavoritesuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	publicContent := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Public", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
	unlistedContent := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Unlisted", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityUnlisted}
	for _, content := range []*entity.Content{publicContent, unlistedContent} {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}
	for _, favorite := range []*entity.Favorite{
		{ID: entity.ID(), UserID: user.ID, ContentID: publicContent.ID},
		{ID: entity.ID(), UserID: user.ID, ContentID: unlistedContent.ID},
	} {
		if err := s.db.Create(favorite).Error; err != nil {
			t.Fatalf("Failed to create favorite: %v", err)
		}
	}

	contents, _, err := s.ListUserPublicFavorites(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListUserPublicFavorites() error = %v", err)
	}
	if len(contents) != 1 || contents[0].ID != publicContent.ID {
		t.Fatalf("contents = %+v, want only public content", contents)
	}
}

func TestService_ListFavorites_OmitsAttachmentsButKeepsGalleryCover(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "listfavoritesgallery", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Favorite gallery",
		Type:         entity.ContentTypeGallery,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	attachment := &entity.Attachment{
		ID:        entity.ID(),
		ContentID: content.ID,
		Type:      entity.AttachmentTypeImage,
		URL:       "favorites/cover.jpg",
		IsCover:   true,
	}
	if err := s.db.Create(attachment).Error; err != nil {
		t.Fatalf("Failed to create test attachment: %v", err)
	}

	favorite := &entity.Favorite{ID: entity.ID(), UserID: user.ID, ContentID: content.ID}
	if err := s.db.Create(favorite).Error; err != nil {
		t.Fatalf("Failed to create favorite: %v", err)
	}

	contents, _, err := s.ListFavorites(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListFavorites() error = %v", err)
	}
	if len(contents) != 1 {
		t.Fatalf("len(contents) = %d, want 1", len(contents))
	}
	if contents[0].ID != content.ID {
		t.Errorf("ID = %q, want %q", contents[0].ID, content.ID)
	}
	if contents[0].CoverURL != "favorites/cover.jpg" {
		t.Errorf("CoverURL = %q, want %q", contents[0].CoverURL, "favorites/cover.jpg")
	}
	if len(contents[0].Attachments) != 0 {
		t.Errorf("len(Attachments) = %d, want 0", len(contents[0].Attachments))
	}
}
