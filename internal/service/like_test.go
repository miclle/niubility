package service

import (
	"context"
	"testing"
	"time"

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

func TestService_ListMyLikesGroupedByContent(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "mylikesuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	author := &entity.User{ID: entity.ID(), Username: "author", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("Failed to create author: %v", err)
	}

	content1 := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Article", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
	content2 := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Gallery", Type: entity.ContentTypeGallery, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityUnlisted}
	if err := s.db.Create(content1).Error; err != nil {
		t.Fatalf("Failed to create content1: %v", err)
	}
	if err := s.db.Create(content2).Error; err != nil {
		t.Fatalf("Failed to create content2: %v", err)
	}

	attachment := &entity.Attachment{
		ID:        entity.ID(),
		ContentID: content2.ID,
		Type:      entity.AttachmentTypeImage,
		URL:       "gallery/photo.jpg",
	}
	if err := s.db.Create(attachment).Error; err != nil {
		t.Fatalf("Failed to create attachment: %v", err)
	}

	topLevelComment := &entity.Comment{
		ID:        entity.ID(),
		ContentID: content1.ID,
		UserID:    author.ID,
		Body:      "top-level",
	}
	attachmentComment := &entity.Comment{
		ID:           entity.ID(),
		ContentID:    content2.ID,
		AttachmentID: attachment.ID,
		UserID:       author.ID,
		Body:         "attachment comment",
	}
	if err := s.db.Create(topLevelComment).Error; err != nil {
		t.Fatalf("Failed to create top-level comment: %v", err)
	}
	if err := s.db.Create(attachmentComment).Error; err != nil {
		t.Fatalf("Failed to create attachment comment: %v", err)
	}

	base := time.Date(2026, 4, 11, 9, 0, 0, 0, time.UTC)
	likes := []entity.Like{
		{ID: entity.ID(), UserID: user.ID, TargetID: content1.ID, TargetType: entity.TargetTypeContent, CreatedAt: base.Add(1 * time.Minute)},
		{ID: entity.ID(), UserID: user.ID, TargetID: topLevelComment.ID, TargetType: entity.TargetTypeComment, CreatedAt: base.Add(2 * time.Minute)},
		{ID: entity.ID(), UserID: user.ID, TargetID: attachment.ID, TargetType: entity.TargetTypeAttachment, CreatedAt: base.Add(3 * time.Minute)},
		{ID: entity.ID(), UserID: user.ID, TargetID: attachmentComment.ID, TargetType: entity.TargetTypeComment, CreatedAt: base.Add(4 * time.Minute)},
	}
	for i := range likes {
		if err := s.db.Create(&likes[i]).Error; err != nil {
			t.Fatalf("Failed to create like %d: %v", i, err)
		}
	}

	items, total, nextCursor, err := s.ListMyLikesGroupedByContent(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListMyLikesGroupedByContent() error = %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	if nextCursor != "" {
		t.Fatalf("nextCursor = %q, want empty", nextCursor)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}

	if items[0].Content.ID != content2.ID {
		t.Fatalf("first content ID = %q, want %q", items[0].Content.ID, content2.ID)
	}
	if items[0].LikedContent {
		t.Errorf("items[0].LikedContent = true, want false")
	}
	if items[0].LikedCommentCount != 1 {
		t.Errorf("items[0].LikedCommentCount = %d, want 1", items[0].LikedCommentCount)
	}
	if items[0].LikedAttachmentCount != 1 {
		t.Errorf("items[0].LikedAttachmentCount = %d, want 1", items[0].LikedAttachmentCount)
	}
	if items[0].RecentTargetType != entity.TargetTypeComment {
		t.Errorf("items[0].RecentTargetType = %q, want %q", items[0].RecentTargetType, entity.TargetTypeComment)
	}
	if items[0].RecentTargetID != attachmentComment.ID {
		t.Errorf("items[0].RecentTargetID = %q, want %q", items[0].RecentTargetID, attachmentComment.ID)
	}
	if items[0].RecentAttachmentID != attachment.ID {
		t.Errorf("items[0].RecentAttachmentID = %q, want %q", items[0].RecentAttachmentID, attachment.ID)
	}

	if items[1].Content.ID != content1.ID {
		t.Fatalf("second content ID = %q, want %q", items[1].Content.ID, content1.ID)
	}
	if !items[1].LikedContent {
		t.Errorf("items[1].LikedContent = false, want true")
	}
	if items[1].LikedCommentCount != 1 {
		t.Errorf("items[1].LikedCommentCount = %d, want 1", items[1].LikedCommentCount)
	}
	if items[1].LikedAttachmentCount != 0 {
		t.Errorf("items[1].LikedAttachmentCount = %d, want 0", items[1].LikedAttachmentCount)
	}
	if items[1].RecentAttachmentID != "" {
		t.Errorf("items[1].RecentAttachmentID = %q, want empty", items[1].RecentAttachmentID)
	}
}

func TestService_ListMyLikesGroupedByContent_FiltersByDetailVisibility(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "mylikesvisibility", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	author := &entity.User{ID: entity.ID(), Username: "mylikesvisibilityauthor", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("Failed to create author: %v", err)
	}

	publicContent := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Public", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityPublic}
	unlistedContent := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Unlisted", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityUnlisted}
	blockedContent := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Blocked", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished, ReviewStatus: entity.ContentReviewStatusApproved, Visibility: entity.ContentVisibilityBlocked}
	for _, content := range []*entity.Content{publicContent, unlistedContent, blockedContent} {
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("Failed to create content: %v", err)
		}
	}

	base := time.Date(2026, 4, 11, 9, 0, 0, 0, time.UTC)
	for i, content := range []*entity.Content{publicContent, unlistedContent, blockedContent} {
		like := &entity.Like{
			ID:         entity.ID(),
			UserID:     user.ID,
			TargetID:   content.ID,
			TargetType: entity.TargetTypeContent,
			CreatedAt:  base.Add(time.Duration(i) * time.Minute),
		}
		if err := s.db.Create(like).Error; err != nil {
			t.Fatalf("Failed to create like: %v", err)
		}
	}

	items, total, _, err := s.ListMyLikesGroupedByContent(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListMyLikesGroupedByContent() error = %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
}

func TestService_ListMyLikesGroupedByContent_Pagination(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "mylikespager", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	base := time.Date(2026, 4, 11, 10, 0, 0, 0, time.UTC)
	contentIDs := make([]string, 0, 3)
	for i := 0; i < 3; i++ {
		content := &entity.Content{
			ID:           entity.ID(),
			AuthorID:     user.ID,
			Title:        "Paged",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		}
		if err := s.db.Create(content).Error; err != nil {
			t.Fatalf("Failed to create content %d: %v", i, err)
		}
		contentIDs = append(contentIDs, content.ID)
		like := &entity.Like{
			ID:         entity.ID(),
			UserID:     user.ID,
			TargetID:   content.ID,
			TargetType: entity.TargetTypeContent,
			CreatedAt:  base.Add(time.Duration(i) * time.Minute),
		}
		if err := s.db.Create(like).Error; err != nil {
			t.Fatalf("Failed to create like %d: %v", i, err)
		}
	}

	firstPage, total, nextCursor, err := s.ListMyLikesGroupedByContent(ctx, user.ID, entity.Pagination{Limit: 2})
	if err != nil {
		t.Fatalf("ListMyLikesGroupedByContent() first page error = %v", err)
	}
	if total != 3 {
		t.Fatalf("total = %d, want 3", total)
	}
	if len(firstPage) != 2 {
		t.Fatalf("len(firstPage) = %d, want 2", len(firstPage))
	}
	if nextCursor == "" {
		t.Fatal("nextCursor = empty, want non-empty")
	}

	secondPage, _, secondCursor, err := s.ListMyLikesGroupedByContent(ctx, user.ID, entity.Pagination{Limit: 2, Cursor: nextCursor})
	if err != nil {
		t.Fatalf("ListMyLikesGroupedByContent() second page error = %v", err)
	}
	if len(secondPage) != 1 {
		t.Fatalf("len(secondPage) = %d, want 1", len(secondPage))
	}
	if secondCursor != "" {
		t.Fatalf("secondCursor = %q, want empty", secondCursor)
	}
	if secondPage[0].Content.ID != contentIDs[0] {
		t.Errorf("secondPage[0].Content.ID = %q, want %q", secondPage[0].Content.ID, contentIDs[0])
	}
}
