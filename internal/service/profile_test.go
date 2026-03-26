package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_UpdateProfile(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create user
	user := &entity.User{
		ID:       entity.ID(),
		Username: "profileuser",
		Name:     "Original Name",
		Bio:      "Original bio",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Update profile
	newName := "Updated Name"
	newBio := "Updated bio"
	newLocation := "New Location"
	updated, err := s.UpdateProfile(ctx, user.ID, entity.UpdateProfileArgs{
		Name:     &newName,
		Bio:      &newBio,
		Location: &newLocation,
	})
	if err != nil {
		t.Fatalf("UpdateProfile() error = %v", err)
	}
	if updated.Name != newName {
		t.Errorf("Name = %q, want %q", updated.Name, newName)
	}
	if updated.Bio != newBio {
		t.Errorf("Bio = %q, want %q", updated.Bio, newBio)
	}
	if updated.Location != newLocation {
		t.Errorf("Location = %q, want %q", updated.Location, newLocation)
	}

	// Update non-existent user
	updated, err = s.UpdateProfile(ctx, "nonexistent-id", entity.UpdateProfileArgs{Name: &newName})
	if err != nil {
		t.Fatalf("UpdateProfile() error = %v", err)
	}
	if updated != nil {
		t.Errorf("UpdateProfile() = %v, want nil", updated)
	}
}

func TestService_UpdateProfile_SocialAccounts(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create user
	user := &entity.User{
		ID:             entity.ID(),
		Username:       "socialuser",
		Name:           "Social User",
		SocialAccounts: map[string]string{},
		Role:           entity.RoleUser,
		Status:         entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Update social accounts
	socialAccounts := map[string]string{
		"github":   "testuser",
		"twitter":  "testuser",
		"linkedin": "testuser",
	}
	updated, err := s.UpdateProfile(ctx, user.ID, entity.UpdateProfileArgs{SocialAccounts: socialAccounts})
	if err != nil {
		t.Fatalf("UpdateProfile() error = %v", err)
	}
	if len(updated.SocialAccounts) != 3 {
		t.Errorf("len(SocialAccounts) = %d, want 3", len(updated.SocialAccounts))
	}
	if updated.SocialAccounts["github"] != "testuser" {
		t.Errorf("SocialAccounts[github] = %q, want %q", updated.SocialAccounts["github"], "testuser")
	}
}

func TestService_GetUserContentCount(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create user
	user := &entity.User{ID: entity.ID(), Username: "contentcountuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents
	contents := []*entity.Content{
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 3", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusDraft},
	}
	for _, c := range contents {
		if err := s.db.Create(c).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}

	count, err := s.GetUserContentCount(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetUserContentCount() error = %v", err)
	}
	if count != 3 {
		t.Errorf("GetUserContentCount() = %d, want 3", count)
	}
}

func TestService_GetUserTotalLikes(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create user
	user := &entity.User{ID: entity.ID(), Username: "totallikesuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents with like counts
	contents := []*entity.Content{
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, LikeCount: 10},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, LikeCount: 20},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 3", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, LikeCount: 5},
	}
	for _, c := range contents {
		if err := s.db.Create(c).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}

	total, err := s.GetUserTotalLikes(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetUserTotalLikes() error = %v", err)
	}
	if total != 35 {
		t.Errorf("GetUserTotalLikes() = %d, want 35", total)
	}
}

func TestService_GetUserSpeakerContentCount(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create users
	author := &entity.User{ID: entity.ID(), Username: "speakercountauthor", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	speaker := &entity.User{ID: entity.ID(), Username: "speakercountspeaker", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(speaker).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents with speaker
	contents := []*entity.Content{
		{ID: entity.ID(), AuthorID: author.ID, SpeakerID: speaker.ID, Title: "Content 1", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished},
		{ID: entity.ID(), AuthorID: author.ID, SpeakerID: speaker.ID, Title: "Content 2", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished},
	}
	for _, c := range contents {
		if err := s.db.Create(c).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}

	count, err := s.GetUserSpeakerContentCount(ctx, speaker.ID)
	if err != nil {
		t.Fatalf("GetUserSpeakerContentCount() error = %v", err)
	}
	if count != 2 {
		t.Errorf("GetUserSpeakerContentCount() = %d, want 2", count)
	}
}
