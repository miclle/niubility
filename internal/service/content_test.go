package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_CreateContent(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{
		ID:       entity.ID(),
		Username: "contentauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		AuthorID: user.ID,
		Title:    "Test Content",
		Summary:  "Test summary",
		Body:     "Test body",
		Type:     entity.ContentTypeArticle,
		Category: "test",
	}

	if err := s.CreateContent(ctx, content, nil); err != nil {
		t.Fatalf("CreateContent() error = %v", err)
	}

	if content.ID == "" {
		t.Error("CreateContent() should set content.ID")
	}

	if content.Status != entity.ContentStatusDraft {
		t.Errorf("Default Status = %q, want %q", content.Status, entity.ContentStatusDraft)
	}
}

func TestService_CreateContent_SetsGalleryCoverFromAttachments(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "creategalleryauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		AuthorID: user.ID,
		Title:    "Gallery",
		Type:     entity.ContentTypeGallery,
		Category: "test",
	}

	attachments := []entity.CreateAttachmentArgs{
		{URL: "gallery/1.jpg", Type: entity.AttachmentTypeImage, SortOrder: 0},
		{URL: "gallery/cover.jpg", Type: entity.AttachmentTypeImage, SortOrder: 1, IsCover: true},
	}

	if err := s.CreateContent(ctx, content, attachments); err != nil {
		t.Fatalf("CreateContent() error = %v", err)
	}

	if content.CoverURL != "/attachments/gallery/cover.jpg" {
		t.Errorf("CoverURL = %q, want %q", content.CoverURL, "/attachments/gallery/cover.jpg")
	}
}

func TestService_CreateContent_NormalizesAttachmentURLs(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "normalizecreateauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		AuthorID: user.ID,
		Title:    "Normalized Content",
		Type:     entity.ContentTypeVideo,
		Category: "test",
		CoverURL: "https://example.com/attachments/contents/123/cover.png",
	}

	attachments := []entity.CreateAttachmentArgs{
		{
			URL:      "https://example.com/attachments/contents/123/video.mp4",
			CoverURL: "https://example.com/attachments/contents/123/video-cover.png",
			Type:     entity.AttachmentTypeVideo,
		},
	}

	if err := s.CreateContent(ctx, content, attachments); err != nil {
		t.Fatalf("CreateContent() error = %v", err)
	}

	var saved entity.Content
	if err := s.db.Preload("Attachments").Where("id = ?", content.ID).First(&saved).Error; err != nil {
		t.Fatalf("load saved content: %v", err)
	}

	if saved.CoverURL != "/attachments/contents/123/cover.png" {
		t.Fatalf("saved CoverURL = %q, want %q", saved.CoverURL, "/attachments/contents/123/cover.png")
	}
	if len(saved.Attachments) != 1 {
		t.Fatalf("saved Attachments length = %d, want 1", len(saved.Attachments))
	}
	if saved.Attachments[0].URL != "/attachments/contents/123/video.mp4" {
		t.Fatalf("saved attachment URL = %q, want %q", saved.Attachments[0].URL, "/attachments/contents/123/video.mp4")
	}
	if saved.Attachments[0].CoverURL != "/attachments/contents/123/video-cover.png" {
		t.Fatalf("saved attachment CoverURL = %q, want %q", saved.Attachments[0].CoverURL, "/attachments/contents/123/video-cover.png")
	}
}

func TestService_GetContentByID(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{
		ID:       entity.ID(),
		Username: "getcontentauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create content
	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Test Content",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Test getting existing content
	got, err := s.GetContentByID(ctx, content.ID)
	if err != nil {
		t.Fatalf("GetContentByID() error = %v", err)
	}
	if got == nil {
		t.Fatal("GetContentByID() returned nil")
		return
	}
	if got.ID != content.ID {
		t.Errorf("ID = %q, want %q", got.ID, content.ID)
	}

	// Test getting non-existent content
	got, err = s.GetContentByID(ctx, "nonexistent-id")
	if err != nil {
		t.Fatalf("GetContentByID() error = %v", err)
	}
	if got != nil {
		t.Errorf("GetContentByID() = %v, want nil", got)
	}
}

func TestService_UpdateContent(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{
		ID:       entity.ID(),
		Username: "updatecontentauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create content
	content := &entity.Content{
		ID:       entity.ID(),
		AuthorID: user.ID,
		Title:    "Original Title",
		Type:     entity.ContentTypeArticle,
		Category: "test",
		Status:   entity.ContentStatusDraft,
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Update title
	newTitle := "Updated Title"
	updated, err := s.UpdateContent(ctx, content.ID, entity.UpdateContentArgs{Title: &newTitle})
	if err != nil {
		t.Fatalf("UpdateContent() error = %v", err)
	}
	if updated.Title != newTitle {
		t.Errorf("Title = %q, want %q", updated.Title, newTitle)
	}

	// Update status
	publishedStatus := entity.ContentStatusPublished
	updated, err = s.UpdateContent(ctx, content.ID, entity.UpdateContentArgs{Status: &publishedStatus})
	if err != nil {
		t.Fatalf("UpdateContent() error = %v", err)
	}
	if updated.Status != entity.ContentStatusPublished {
		t.Errorf("Status = %q, want %q", updated.Status, entity.ContentStatusPublished)
	}

	// Update non-existent content
	updated, err = s.UpdateContent(ctx, "nonexistent-id", entity.UpdateContentArgs{Title: &newTitle})
	if err != nil {
		t.Fatalf("UpdateContent() error = %v", err)
	}
	if updated != nil {
		t.Errorf("UpdateContent() = %v, want nil", updated)
	}
}

func TestService_UpdateContent_UpdatesSpeakerFields(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	author := &entity.User{
		ID:       entity.ID(),
		Username: "speakercontentauthor",
		Name:     "Author",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("Failed to create author: %v", err)
	}

	speaker := &entity.User{
		ID:       entity.ID(),
		Username: "newspeaker",
		Name:     "New Speaker",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(speaker).Error; err != nil {
		t.Fatalf("Failed to create speaker: %v", err)
	}

	content := &entity.Content{
		ID:          entity.ID(),
		AuthorID:    author.ID,
		Title:       "Speaker Update",
		Type:        entity.ContentTypePodcast,
		Category:    "test",
		Status:      entity.ContentStatusDraft,
		SpeakerName: "Legacy Speaker",
		SpeakerBio:  "Legacy Bio",
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	speakerID := speaker.ID
	speakerBio := "Updated Bio"
	updated, err := s.UpdateContent(ctx, content.ID, entity.UpdateContentArgs{
		SpeakerID:  &speakerID,
		SpeakerBio: &speakerBio,
	})
	if err != nil {
		t.Fatalf("UpdateContent() error = %v", err)
	}
	if updated.SpeakerID != speaker.ID {
		t.Fatalf("SpeakerID = %q, want %q", updated.SpeakerID, speaker.ID)
	}
	if updated.SpeakerName != "" {
		t.Fatalf("SpeakerName = %q, want empty when SpeakerID is set", updated.SpeakerName)
	}
	if updated.Speaker == nil || updated.Speaker.ID != speaker.ID {
		t.Fatalf("Speaker preload missing or incorrect: %+v", updated.Speaker)
	}
	if updated.SpeakerBio != speakerBio {
		t.Fatalf("SpeakerBio = %q, want %q", updated.SpeakerBio, speakerBio)
	}

	manualSpeakerName := "Manual Speaker"
	updated, err = s.UpdateContent(ctx, content.ID, entity.UpdateContentArgs{
		SpeakerName: &manualSpeakerName,
	})
	if err != nil {
		t.Fatalf("UpdateContent() manual speaker error = %v", err)
	}
	if updated.SpeakerID != "" {
		t.Fatalf("SpeakerID = %q, want empty when SpeakerName is set", updated.SpeakerID)
	}
	if updated.SpeakerName != manualSpeakerName {
		t.Fatalf("SpeakerName = %q, want %q", updated.SpeakerName, manualSpeakerName)
	}
}

func TestService_UpdateContent_RefreshesGalleryCoverFromAttachments(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "updategalleryauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Gallery",
		Type:         entity.ContentTypeGallery,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
		CoverURL:     "gallery/old-cover.jpg",
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	oldAttachment := &entity.Attachment{
		ID:        entity.ID(),
		ContentID: content.ID,
		URL:       "gallery/old-cover.jpg",
		Type:      entity.AttachmentTypeImage,
		IsCover:   true,
	}
	if err := s.db.Create(oldAttachment).Error; err != nil {
		t.Fatalf("Failed to create old attachment: %v", err)
	}

	updated, err := s.UpdateContent(ctx, content.ID, entity.UpdateContentArgs{
		Attachments: []entity.CreateAttachmentArgs{
			{URL: "gallery/1.jpg", Type: entity.AttachmentTypeImage, SortOrder: 0},
			{URL: "gallery/new-cover.jpg", Type: entity.AttachmentTypeImage, SortOrder: 1, IsCover: true},
		},
	})
	if err != nil {
		t.Fatalf("UpdateContent() error = %v", err)
	}

	if updated.CoverURL != "/attachments/gallery/new-cover.jpg" {
		t.Errorf("CoverURL = %q, want %q", updated.CoverURL, "/attachments/gallery/new-cover.jpg")
	}

	listed, _, err := s.ListContents(ctx, entity.ListContentsArgs{Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(listed) != 1 {
		t.Fatalf("len(listed) = %d, want 1", len(listed))
	}
	if listed[0].CoverURL != "/attachments/gallery/new-cover.jpg" {
		t.Errorf("listed CoverURL = %q, want %q", listed[0].CoverURL, "/attachments/gallery/new-cover.jpg")
	}
}

func TestService_DeleteContent(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{
		ID:       entity.ID(),
		Username: "deletecontentauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create content
	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "To Delete",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	// Delete content
	if err := s.DeleteContent(ctx, content.ID); err != nil {
		t.Fatalf("DeleteContent() error = %v", err)
	}

	// Verify content was deleted
	got, err := s.GetContentByID(ctx, content.ID)
	if err != nil {
		t.Fatalf("GetContentByID() error = %v", err)
	}
	if got != nil {
		t.Error("Content should be deleted")
	}
}

func TestService_ListContents(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create author
	user := &entity.User{
		ID:       entity.ID(),
		Username: "listcontentauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create contents
	contents := []*entity.Content{
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 1", Type: entity.ContentTypeArticle, Category: "cat1", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 2", Type: entity.ContentTypeArticle, Category: "cat1", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic},
		{ID: entity.ID(), AuthorID: user.ID, Title: "Content 3", Type: entity.ContentTypeVideo, Category: "cat2", Status: entity.ContentStatusDraft},
	}
	for _, c := range contents {
		if err := s.db.Create(c).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}

	// List published contents (default)
	got, _, err := s.ListContents(ctx, entity.ListContentsArgs{Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 2 {
		t.Errorf("len(got) = %d, want 2 (only published)", len(got))
	}

	// List all contents
	got, _, err = s.ListContents(ctx, entity.ListContentsArgs{Status: "all", Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 3 {
		t.Errorf("len(got) = %d, want 3", len(got))
	}

	// List by category
	got, _, err = s.ListContents(ctx, entity.ListContentsArgs{Category: "cat1", Status: "all", Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 2 {
		t.Errorf("len(got) = %d, want 2", len(got))
	}

	// List by type
	got, _, err = s.ListContents(ctx, entity.ListContentsArgs{Type: entity.ContentTypeVideo, Status: "all", Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 1 {
		t.Errorf("len(got) = %d, want 1", len(got))
	}
}

func TestService_ListContents_OmitsAttachmentsButKeepsGalleryCover(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "listcontentgallerycover",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Gallery content",
		Type:         entity.ContentTypeGallery,
		Category:     "gallery",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("Failed to create test content: %v", err)
	}

	attachments := []*entity.Attachment{
		{
			ID:        entity.ID(),
			ContentID: content.ID,
			Type:      entity.AttachmentTypeImage,
			URL:       "gallery/1.jpg",
			SortOrder: 1,
		},
		{
			ID:        entity.ID(),
			ContentID: content.ID,
			Type:      entity.AttachmentTypeImage,
			URL:       "gallery/cover.jpg",
			IsCover:   true,
			SortOrder: 2,
		},
	}
	for _, attachment := range attachments {
		if err := s.db.Create(attachment).Error; err != nil {
			t.Fatalf("Failed to create test attachment: %v", err)
		}
	}

	got, _, err := s.ListContents(ctx, entity.ListContentsArgs{Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len(got) = %d, want 1", len(got))
	}
	if got[0].ID != content.ID {
		t.Errorf("ID = %q, want %q", got[0].ID, content.ID)
	}
	if got[0].CoverURL != "gallery/cover.jpg" {
		t.Errorf("CoverURL = %q, want %q", got[0].CoverURL, "gallery/cover.jpg")
	}
	if len(got[0].Attachments) != 0 {
		t.Errorf("len(Attachments) = %d, want 0", len(got[0].Attachments))
	}
}

func TestService_ListContents_IncludesPodcastAttachmentsForPodcastLists(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "listcontentpodcastattachments",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	podcast := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Podcast content",
		Type:         entity.ContentTypePodcast,
		Category:     "podcast",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := s.db.Create(podcast).Error; err != nil {
		t.Fatalf("Failed to create test podcast: %v", err)
	}

	attachments := []*entity.Attachment{
		{
			ID:        entity.ID(),
			ContentID: podcast.ID,
			Type:      entity.AttachmentTypeAudio,
			URL:       "podcasts/ep1.mp3",
			Title:     "Episode 1",
			Filename:  "ep1.mp3",
			FileSize:  1024,
			SortOrder: 1,
		},
		{
			ID:        entity.ID(),
			ContentID: podcast.ID,
			Type:      entity.AttachmentTypeAudio,
			URL:       "podcasts/ep2.mp3",
			Title:     "Episode 2",
			Filename:  "ep2.mp3",
			FileSize:  2048,
			SortOrder: 2,
		},
	}
	for _, attachment := range attachments {
		if err := s.db.Create(attachment).Error; err != nil {
			t.Fatalf("Failed to create podcast attachment: %v", err)
		}
	}

	got, _, err := s.ListContents(ctx, entity.ListContentsArgs{
		Type:       entity.ContentTypePodcast,
		AuthorID:   user.ID,
		Pagination: entity.Pagination{Limit: 10},
	})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len(got) = %d, want 1", len(got))
	}
	if len(got[0].Attachments) != 2 {
		t.Fatalf("len(Attachments) = %d, want 2", len(got[0].Attachments))
	}
	if got[0].Attachments[0].Title != "Episode 1" || got[0].Attachments[1].Title != "Episode 2" {
		t.Fatalf("unexpected attachment ordering: %+v", got[0].Attachments)
	}
}

func TestService_ListContents_FiltersProfileContentsBySpeakerThenFallbackAuthor(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	profileUser := &entity.User{
		ID:       entity.ID(),
		Username: "profilefilteruser",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	otherUser := &entity.User{
		ID:       entity.ID(),
		Username: "profilefilterother",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(profileUser).Error; err != nil {
		t.Fatalf("Failed to create profile user: %v", err)
	}
	if err := s.db.Create(otherUser).Error; err != nil {
		t.Fatalf("Failed to create other user: %v", err)
	}

	contents := []*entity.Content{
		{
			ID:        entity.ID(),
			AuthorID:  otherUser.ID,
			SpeakerID: profileUser.ID,
			Title:     "Match by speaker",
			Type:      entity.ContentTypeArticle,
			Category:  "test",
			Status:    entity.ContentStatusPublished,
		},
		{
			ID:       entity.ID(),
			AuthorID: profileUser.ID,
			Title:    "Match by fallback author",
			Type:     entity.ContentTypeArticle,
			Category: "test",
			Status:   entity.ContentStatusPublished,
		},
		{
			ID:          entity.ID(),
			AuthorID:    profileUser.ID,
			SpeakerName: "Manual Speaker",
			Title:       "Do not match manual speaker",
			Type:        entity.ContentTypeArticle,
			Category:    "test",
			Status:      entity.ContentStatusPublished,
		},
		{
			ID:       entity.ID(),
			AuthorID: otherUser.ID,
			Title:    "Do not match unrelated",
			Type:     entity.ContentTypeArticle,
			Category: "test",
			Status:   entity.ContentStatusPublished,
		},
	}
	for _, content := range contents {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("Failed to create test content: %v", err)
		}
	}

	got, _, err := s.ListContents(ctx, entity.ListContentsArgs{
		ProfileUserID: profileUser.ID,
		Pagination:    entity.Pagination{Limit: 10},
		Status:        "all",
	})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(got) = %d, want 2", len(got))
	}

	gotTitles := map[string]bool{}
	for _, item := range got {
		gotTitles[item.Title] = true
	}
	if !gotTitles["Match by speaker"] {
		t.Fatalf("expected content matched by speaker to be included: %+v", gotTitles)
	}
	if !gotTitles["Match by fallback author"] {
		t.Fatalf("expected content matched by fallback author to be included: %+v", gotTitles)
	}
	if gotTitles["Do not match manual speaker"] || gotTitles["Do not match unrelated"] {
		t.Fatalf("unexpected contents returned: %+v", gotTitles)
	}
}

func TestService_ListContents_DefaultsToApprovedPublicOnly(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	author := &entity.User{
		ID:       entity.ID(),
		Username: "publiclistauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("create author: %v", err)
	}

	contents := []*entity.Content{
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Public content",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Unlisted content",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityUnlisted,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Pending content",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusPending,
			Visibility:   entity.ContentVisibilityPublic,
		},
	}
	for _, content := range contents {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("create content: %v", err)
		}
	}

	got, _, err := s.ListContents(ctx, entity.ListContentsArgs{Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListContents() error = %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len(got) = %d, want 1", len(got))
	}
	if got[0].Title != "Public content" {
		t.Fatalf("title = %q, want %q", got[0].Title, "Public content")
	}
}

func TestService_ListUserPublicContents_FiltersToApprovedPublicAuthorItems(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	profileUser := &entity.User{
		ID:       entity.ID(),
		Username: "profilepublicuser",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	otherUser := &entity.User{
		ID:       entity.ID(),
		Username: "profilepublicother",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(profileUser).Error; err != nil {
		t.Fatalf("create profile user: %v", err)
	}
	if err := s.db.Create(otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	contents := []*entity.Content{
		{
			ID:           entity.ID(),
			AuthorID:     profileUser.ID,
			Title:        "Fallback public",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     profileUser.ID,
			SpeakerName:  "Profile Speaker",
			Title:        "Author public with manual speaker",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     otherUser.ID,
			SpeakerID:    profileUser.ID,
			Title:        "Speaker public only",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     profileUser.ID,
			Title:        "Unlisted fallback",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityUnlisted,
		},
	}
	for _, content := range contents {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("create content: %v", err)
		}
	}

	got, _, err := s.ListUserPublicContents(ctx, profileUser.ID, entity.ListContentsArgs{
		Pagination: entity.Pagination{Limit: 10},
	})
	if err != nil {
		t.Fatalf("ListUserPublicContents() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(got) = %d, want 2", len(got))
	}

	gotTitles := map[string]bool{}
	for _, item := range got {
		gotTitles[item.Title] = true
	}
	if !gotTitles["Fallback public"] || !gotTitles["Author public with manual speaker"] {
		t.Fatalf("expected authored public items to be included: %+v", gotTitles)
	}
	if gotTitles["Speaker public only"] || gotTitles["Unlisted fallback"] {
		t.Fatalf("unexpected items returned: %+v", gotTitles)
	}
}

func TestService_ListMyContents_ReturnsAuthorOwnedContentsRegardlessOfVisibility(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	author := &entity.User{
		ID:       entity.ID(),
		Username: "mycontentsauthor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	otherUser := &entity.User{
		ID:       entity.ID(),
		Username: "mycontentsother",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("create author: %v", err)
	}
	if err := s.db.Create(otherUser).Error; err != nil {
		t.Fatalf("create other user: %v", err)
	}

	contents := []*entity.Content{
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Draft owned",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusDraft,
			ReviewStatus: entity.ContentReviewStatusPending,
			Visibility:   entity.ContentVisibilityPrivate,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Blocked owned",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityBlocked,
		},
		{
			ID:           entity.ID(),
			AuthorID:     otherUser.ID,
			Title:        "Other public",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
	}
	for _, content := range contents {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("create content: %v", err)
		}
	}

	got, _, err := s.ListMyContents(ctx, author.ID, entity.ListContentsArgs{
		Pagination: entity.Pagination{Limit: 10},
	})
	if err != nil {
		t.Fatalf("ListMyContents() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("len(got) = %d, want 2", len(got))
	}
}

func TestGalleryVideoMaxFileSize(t *testing.T) {
	expected := int64(200 * 1024 * 1024) // 200 MB
	if GalleryVideoMaxFileSize != expected {
		t.Errorf("GalleryVideoMaxFileSize = %d, want %d", GalleryVideoMaxFileSize, expected)
	}
}
