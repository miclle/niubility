package service

import (
	"context"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_RecordContentView(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "viewer", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	content := &entity.Content{ID: entity.ID(), AuthorID: user.ID, Title: "Viewed", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("create content: %v", err)
	}

	firstNow := time.Date(2026, 4, 11, 10, 0, 0, 0, time.UTC)
	secondNow := firstNow.Add(2 * time.Hour)
	s.now = func() time.Time { return firstNow }

	if err := s.RecordContentView(ctx, user.ID, content.ID); err != nil {
		t.Fatalf("RecordContentView() first error = %v", err)
	}

	var record entity.ContentView
	if err := s.db.Where("user_id = ? AND content_id = ?", user.ID, content.ID).First(&record).Error; err != nil {
		t.Fatalf("load content view: %v", err)
	}
	if record.ViewCount != 1 {
		t.Fatalf("ViewCount = %d, want 1", record.ViewCount)
	}
	if !record.FirstViewedAt.Equal(firstNow) || !record.LastViewedAt.Equal(firstNow) {
		t.Fatalf("view times = (%v, %v), want both %v", record.FirstViewedAt, record.LastViewedAt, firstNow)
	}

	s.now = func() time.Time { return secondNow }
	if err := s.RecordContentView(ctx, user.ID, content.ID); err != nil {
		t.Fatalf("RecordContentView() second error = %v", err)
	}

	if err := s.db.Where("id = ?", record.ID).First(&record).Error; err != nil {
		t.Fatalf("reload content view: %v", err)
	}
	if record.ViewCount != 2 {
		t.Fatalf("ViewCount = %d, want 2", record.ViewCount)
	}
	if !record.FirstViewedAt.Equal(firstNow) {
		t.Fatalf("FirstViewedAt = %v, want %v", record.FirstViewedAt, firstNow)
	}
	if !record.LastViewedAt.Equal(secondNow) {
		t.Fatalf("LastViewedAt = %v, want %v", record.LastViewedAt, secondNow)
	}
}

func TestService_ListMyContentViews(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "historyuser", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	author := &entity.User{ID: entity.ID(), Username: "author", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := s.db.Create(author).Error; err != nil {
		t.Fatalf("create author: %v", err)
	}

	video := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Video", Type: entity.ContentTypeVideo, Category: "test", Status: entity.ContentStatusPublished}
	article := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Article", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	draft := &entity.Content{ID: entity.ID(), AuthorID: author.ID, Title: "Draft", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusDraft}
	if err := s.db.Create(video).Error; err != nil {
		t.Fatalf("create video: %v", err)
	}
	if err := s.db.Create(article).Error; err != nil {
		t.Fatalf("create article: %v", err)
	}
	if err := s.db.Create(draft).Error; err != nil {
		t.Fatalf("create draft: %v", err)
	}

	older := time.Date(2026, 4, 10, 8, 0, 0, 0, time.UTC)
	newer := older.Add(2 * time.Hour)
	if err := s.db.Create(&entity.ContentView{
		ID:            entity.ID(),
		UserID:        user.ID,
		ContentID:     video.ID,
		FirstViewedAt: older,
		LastViewedAt:  older,
		ViewCount:     1,
	}).Error; err != nil {
		t.Fatalf("create video view: %v", err)
	}
	if err := s.db.Create(&entity.ContentView{
		ID:            entity.ID(),
		UserID:        user.ID,
		ContentID:     article.ID,
		FirstViewedAt: newer,
		LastViewedAt:  newer,
		ViewCount:     3,
	}).Error; err != nil {
		t.Fatalf("create article view: %v", err)
	}
	if err := s.db.Create(&entity.ContentView{
		ID:            entity.ID(),
		UserID:        user.ID,
		ContentID:     draft.ID,
		FirstViewedAt: newer.Add(time.Hour),
		LastViewedAt:  newer.Add(time.Hour),
		ViewCount:     1,
	}).Error; err != nil {
		t.Fatalf("create draft view: %v", err)
	}

	items, nextCursor, err := s.ListMyContentViews(ctx, user.ID, entity.ListMyContentViewsArgs{
		Pagination: entity.Pagination{Limit: 10},
	})
	if err != nil {
		t.Fatalf("ListMyContentViews() error = %v", err)
	}
	if nextCursor != "" {
		t.Fatalf("nextCursor = %q, want empty", nextCursor)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
	if items[0].Content.ID != article.ID || items[0].ViewCount != 3 {
		t.Fatalf("first item = %+v, want article with view_count 3", items[0])
	}
	if items[1].Content.ID != video.ID {
		t.Fatalf("second item content ID = %q, want %q", items[1].Content.ID, video.ID)
	}

	filtered, _, err := s.ListMyContentViews(ctx, user.ID, entity.ListMyContentViewsArgs{
		Pagination: entity.Pagination{Limit: 10},
		Type:       entity.ContentTypeVideo,
	})
	if err != nil {
		t.Fatalf("ListMyContentViews() with type error = %v", err)
	}
	if len(filtered) != 1 || filtered[0].Content.ID != video.ID {
		t.Fatalf("filtered items = %+v, want only video", filtered)
	}
}

func TestService_ListContentViewUsers(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	content := &entity.Content{ID: entity.ID(), AuthorID: entity.ID(), Title: "Admin View", Type: entity.ContentTypeArticle, Category: "test", Status: entity.ContentStatusPublished}
	if err := s.db.Create(content).Error; err != nil {
		t.Fatalf("create content: %v", err)
	}

	firstUser := &entity.User{ID: entity.ID(), Username: "first", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	secondUser := &entity.User{ID: entity.ID(), Username: "second", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(firstUser).Error; err != nil {
		t.Fatalf("create first user: %v", err)
	}
	if err := s.db.Create(secondUser).Error; err != nil {
		t.Fatalf("create second user: %v", err)
	}

	firstTime := time.Date(2026, 4, 10, 9, 0, 0, 0, time.UTC)
	secondTime := firstTime.Add(time.Hour)
	if err := s.db.Create(&entity.ContentView{
		ID:            entity.ID(),
		UserID:        firstUser.ID,
		ContentID:     content.ID,
		FirstViewedAt: firstTime,
		LastViewedAt:  firstTime,
		ViewCount:     1,
	}).Error; err != nil {
		t.Fatalf("create first content view: %v", err)
	}
	if err := s.db.Create(&entity.ContentView{
		ID:            entity.ID(),
		UserID:        secondUser.ID,
		ContentID:     content.ID,
		FirstViewedAt: secondTime,
		LastViewedAt:  secondTime,
		ViewCount:     2,
	}).Error; err != nil {
		t.Fatalf("create second content view: %v", err)
	}

	items, nextCursor, err := s.ListContentViewUsers(ctx, content.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListContentViewUsers() error = %v", err)
	}
	if nextCursor != "" {
		t.Fatalf("nextCursor = %q, want empty", nextCursor)
	}
	if len(items) != 2 {
		t.Fatalf("len(items) = %d, want 2", len(items))
	}
	if items[0].User.ID != secondUser.ID || items[0].ViewCount != 2 {
		t.Fatalf("first item = %+v, want second user with view_count 2", items[0])
	}
}
