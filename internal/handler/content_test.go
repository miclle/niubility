package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestListContents(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	admin := &entity.User{
		Username: "admin",
		Name:     "Admin",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, admin)
	token := te.issueTestToken(t, admin)

	// Seed a content
	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     admin.ID,
		Title:        "Test Article",
		Body:         "body text",
		Type:         entity.ContentTypeArticle,
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := te.db.Create(content).Error; err != nil {
		t.Fatalf("seed content: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/contents", nil)
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("ListContents status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp ListContentsResponse
	decodeJSON(t, rec.Body, &resp)
	if len(resp.Items) == 0 {
		t.Fatal("ListContents returned 0 items, want at least 1")
	}
	if resp.Items[0].Title != "Test Article" {
		t.Errorf("title = %q, want %q", resp.Items[0].Title, "Test Article")
	}
}

func TestGetContent(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	user := &entity.User{
		Username: "viewer",
		Name:     "Viewer",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, user)
	token := te.issueTestToken(t, user)

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     user.ID,
		Title:        "Visible Article",
		Body:         "content body",
		Type:         entity.ContentTypeArticle,
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := te.db.Create(content).Error; err != nil {
		t.Fatalf("seed content: %v", err)
	}

	t.Run("existing content returns 200", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/contents/"+content.ID, nil)
		req.AddCookie(authCookie(token))
		rec := te.doRequest(req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}

		var resp GetContentResponse
		decodeJSON(t, rec.Body, &resp)
		if resp.Title != "Visible Article" {
			t.Errorf("title = %q, want %q", resp.Title, "Visible Article")
		}
	})

	t.Run("non-existent content returns 404", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/contents/nonexistent", nil)
		req.AddCookie(authCookie(token))
		rec := te.doRequest(req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
	})
}

func TestGetContent_VisibilityRules(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	author := &entity.User{
		Username: "visibility-author",
		Name:     "Visibility Author",
		Role:     entity.RoleUser,
	}
	viewer := &entity.User{
		Username: "visibility-viewer",
		Name:     "Visibility Viewer",
		Role:     entity.RoleUser,
	}
	admin := &entity.User{
		Username: "visibility-admin",
		Name:     "Visibility Admin",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, author)
	te.createTestUser(t, viewer)
	te.createTestUser(t, admin)

	authorToken := te.issueTestToken(t, author)
	viewerToken := te.issueTestToken(t, viewer)
	adminToken := te.issueTestToken(t, admin)

	items := []*entity.Content{
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Public",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Unlisted",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityUnlisted,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Private",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusPending,
			Visibility:   entity.ContentVisibilityPrivate,
		},
		{
			ID:           entity.ID(),
			AuthorID:     author.ID,
			Title:        "Blocked",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityBlocked,
		},
	}
	for _, item := range items {
		if err := te.db.Create(item).Error; err != nil {
			t.Fatalf("seed content: %v", err)
		}
	}

	cases := []struct {
		name      string
		contentID string
		token     string
		wantCode  int
	}{
		{name: "viewer can access public", contentID: items[0].ID, token: viewerToken, wantCode: http.StatusOK},
		{name: "viewer can access unlisted", contentID: items[1].ID, token: viewerToken, wantCode: http.StatusOK},
		{name: "viewer cannot access private", contentID: items[2].ID, token: viewerToken, wantCode: http.StatusNotFound},
		{name: "viewer cannot access blocked", contentID: items[3].ID, token: viewerToken, wantCode: http.StatusNotFound},
		{name: "author can access private", contentID: items[2].ID, token: authorToken, wantCode: http.StatusOK},
		{name: "author can access blocked", contentID: items[3].ID, token: authorToken, wantCode: http.StatusOK},
		{name: "admin can access blocked", contentID: items[3].ID, token: adminToken, wantCode: http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/contents/"+tc.contentID, nil)
			req.AddCookie(authCookie(tc.token))
			rec := te.doRequest(req)
			if rec.Code != tc.wantCode {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tc.wantCode, rec.Body.String())
			}
		})
	}
}

func TestListProfileContentsAndUserContents(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	owner := &entity.User{
		Username: "content-owner",
		Name:     "Content Owner",
		Role:     entity.RoleUser,
	}
	other := &entity.User{
		Username: "content-other",
		Name:     "Content Other",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, owner)
	te.createTestUser(t, other)

	ownerToken := te.issueTestToken(t, owner)
	otherToken := te.issueTestToken(t, other)

	contents := []*entity.Content{
		{
			ID:           entity.ID(),
			AuthorID:     owner.ID,
			Title:        "Owner draft",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusDraft,
			ReviewStatus: entity.ContentReviewStatusPending,
			Visibility:   entity.ContentVisibilityPrivate,
		},
		{
			ID:           entity.ID(),
			AuthorID:     owner.ID,
			Title:        "Owner public",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityPublic,
		},
		{
			ID:           entity.ID(),
			AuthorID:     owner.ID,
			Title:        "Owner unlisted",
			Type:         entity.ContentTypeArticle,
			Category:     "test",
			Status:       entity.ContentStatusPublished,
			ReviewStatus: entity.ContentReviewStatusApproved,
			Visibility:   entity.ContentVisibilityUnlisted,
		},
	}
	for _, item := range contents {
		if err := te.db.Create(item).Error; err != nil {
			t.Fatalf("seed content: %v", err)
		}
	}

	t.Run("profile contents returns all owner items", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/profile/contents", nil)
		req.AddCookie(authCookie(ownerToken))
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
		var resp ListContentsResponse
		decodeJSON(t, rec.Body, &resp)
		if len(resp.Items) != 3 {
			t.Fatalf("len(items) = %d, want 3", len(resp.Items))
		}
	})

	t.Run("user contents returns only public items", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+owner.Username+"/contents", nil)
		req.AddCookie(authCookie(otherToken))
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
		var resp ListContentsResponse
		decodeJSON(t, rec.Body, &resp)
		if len(resp.Items) != 1 {
			t.Fatalf("len(items) = %d, want 1", len(resp.Items))
		}
		if resp.Items[0].Title != "Owner public" {
			t.Fatalf("title = %q, want %q", resp.Items[0].Title, "Owner public")
		}
	})
}

func TestPublicContentEndpoints_AllowUnauthenticatedRead(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	owner := &entity.User{
		Username: "public-owner",
		Name:     "Public Owner",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, owner)

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     owner.ID,
		Title:        "Public article",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := te.db.Create(content).Error; err != nil {
		t.Fatalf("seed content: %v", err)
	}

	t.Run("public contents list", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/contents", nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
	})

	t.Run("public content detail", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/contents/"+content.ID, nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
	})

	t.Run("public user profile", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+owner.Username+"/profile", nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
	})

	t.Run("public user contents", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+owner.Username+"/contents", nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
		var resp ListContentsResponse
		decodeJSON(t, rec.Body, &resp)
		if len(resp.Items) != 1 {
			t.Fatalf("len(items) = %d, want 1", len(resp.Items))
		}
		if resp.Items[0].Title != "Public article" {
			t.Fatalf("title = %q, want %q", resp.Items[0].Title, "Public article")
		}
	})

	t.Run("public user favorites", func(t *testing.T) {
		favorite := &entity.Favorite{ID: entity.ID(), UserID: owner.ID, ContentID: content.ID}
		if err := te.db.Create(favorite).Error; err != nil {
			t.Fatalf("seed favorite: %v", err)
		}
		req := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+owner.Username+"/favorites", nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
	})
}

func TestContentInteractionEndpoints_RespectVisibility(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	author := &entity.User{Username: "interaction-author", Name: "Interaction Author", Role: entity.RoleUser}
	viewer := &entity.User{Username: "interaction-viewer", Name: "Interaction Viewer", Role: entity.RoleUser}
	te.createTestUser(t, author)
	te.createTestUser(t, viewer)
	viewerToken := te.issueTestToken(t, viewer)

	privateContent := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "Private content",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusPending,
		Visibility:   entity.ContentVisibilityPrivate,
	}
	publicContent := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "Public content",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	for _, content := range []*entity.Content{privateContent, publicContent} {
		if err := te.db.Create(content).Error; err != nil {
			t.Fatalf("seed content: %v", err)
		}
	}

	comment := &entity.Comment{ID: entity.ID(), ContentID: privateContent.ID, UserID: author.ID, Body: "private comment"}
	if err := te.db.Create(comment).Error; err != nil {
		t.Fatalf("seed comment: %v", err)
	}
	attachment := &entity.Attachment{ID: entity.ID(), ContentID: privateContent.ID, Type: entity.AttachmentTypeImage, URL: "private/image.jpg"}
	if err := te.db.Create(attachment).Error; err != nil {
		t.Fatalf("seed attachment: %v", err)
	}

	t.Run("favorite private content denied", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/contents/"+privateContent.ID+"/favorite", nil)
		req.AddCookie(authCookie(viewerToken))
		rec := te.doRequest(req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusNotFound, rec.Body.String())
		}
	})

	t.Run("record private content view denied", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/contents/"+privateContent.ID+"/view", bytes.NewReader([]byte(`{}`)))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(authCookie(viewerToken))
		rec := te.doRequest(req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusNotFound, rec.Body.String())
		}
	})

	t.Run("like private content targets denied", func(t *testing.T) {
		for _, body := range []string{
			`{"target_type":"content","target_id":"` + privateContent.ID + `"}`,
			`{"target_type":"comment","target_id":"` + comment.ID + `"}`,
			`{"target_type":"attachment","target_id":"` + attachment.ID + `"}`,
		} {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/likes", bytes.NewReader([]byte(body)))
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(authCookie(viewerToken))
			rec := te.doRequest(req)
			if rec.Code != http.StatusNotFound {
				t.Fatalf("body %s status = %d, want %d; resp = %s", body, rec.Code, http.StatusNotFound, rec.Body.String())
			}
		}
	})
}

func TestCommentsEndpoints_RespectVisibilityAndAllowPublicRead(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	author := &entity.User{Username: "comment-author", Name: "Comment Author", Role: entity.RoleUser}
	viewer := &entity.User{Username: "comment-viewer", Name: "Comment Viewer", Role: entity.RoleUser}
	te.createTestUser(t, author)
	te.createTestUser(t, viewer)
	viewerToken := te.issueTestToken(t, viewer)

	publicContent := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "Public content",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	privateContent := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "Private content",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusPending,
		Visibility:   entity.ContentVisibilityPrivate,
	}
	for _, content := range []*entity.Content{publicContent, privateContent} {
		if err := te.db.Create(content).Error; err != nil {
			t.Fatalf("seed content: %v", err)
		}
	}

	publicComment := &entity.Comment{ID: entity.ID(), ContentID: publicContent.ID, UserID: author.ID, Body: "hello public"}
	privateComment := &entity.Comment{ID: entity.ID(), ContentID: privateContent.ID, UserID: author.ID, Body: "hello private"}
	for _, comment := range []*entity.Comment{publicComment, privateComment} {
		if err := te.db.Create(comment).Error; err != nil {
			t.Fatalf("seed comment: %v", err)
		}
	}

	t.Run("public comments list allows unauthenticated read", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/comments?content_id="+publicContent.ID, nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}
		var resp ListCommentsResponse
		decodeJSON(t, rec.Body, &resp)
		if len(resp.Items) != 1 {
			t.Fatalf("len(items) = %d, want 1", len(resp.Items))
		}
		if len(resp.LikedCommentIDs) != 0 {
			t.Fatalf("len(liked_comment_ids) = %d, want 0", len(resp.LikedCommentIDs))
		}
	})

	t.Run("private comments list is hidden", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/comments?content_id="+privateContent.ID, nil)
		rec := te.doRequest(req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusNotFound, rec.Body.String())
		}
	})

	t.Run("cannot comment on private content", func(t *testing.T) {
		body := []byte(`{"content_id":"` + privateContent.ID + `","body":"blocked"}`)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/comments", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(authCookie(viewerToken))
		rec := te.doRequest(req)
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusNotFound, rec.Body.String())
		}
	})
}

func TestCreateContent(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	user := &entity.User{
		Username: "author",
		Name:     "Author",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, user)
	token := te.issueTestToken(t, user)

	args := entity.CreateContentArgs{
		Title:  "New Article",
		Body:   "new body",
		Type:   entity.ContentTypeArticle,
		Status: entity.ContentStatusPublished,
	}
	body, _ := json.Marshal(args)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/contents", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("CreateContent status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var created entity.Content
	decodeJSON(t, rec.Body, &created)
	if created.Title != "New Article" {
		t.Errorf("title = %q, want %q", created.Title, "New Article")
	}
	if created.AuthorID != user.ID {
		t.Errorf("author_id = %q, want %q", created.AuthorID, user.ID)
	}
}

func TestCreateContent_Unauthenticated(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	args := entity.CreateContentArgs{
		Title: "Should Fail",
		Body:  "body",
		Type:  entity.ContentTypeArticle,
	}
	body, _ := json.Marshal(args)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/contents", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := te.doRequest(req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestDeleteContent(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	author := &entity.User{
		Username: "author-del",
		Name:     "Author Del",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, author)
	token := te.issueTestToken(t, author)

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "To Delete",
		Body:         "will be deleted",
		Type:         entity.ContentTypeArticle,
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusApproved,
		Visibility:   entity.ContentVisibilityPublic,
	}
	if err := te.db.Create(content).Error; err != nil {
		t.Fatalf("seed content: %v", err)
	}

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/contents/"+content.ID, nil)
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("DeleteContent status = %d, want %d; body = %s", rec.Code, http.StatusNoContent, rec.Body.String())
	}

	// Verify content is gone
	req = httptest.NewRequest(http.MethodGet, "/api/v1/contents/"+content.ID, nil)
	req.AddCookie(authCookie(token))
	rec = te.doRequest(req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("after delete: status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestListContentModerationLogs(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	author := &entity.User{Username: "log-author", Name: "Author", Role: entity.RoleUser}
	admin := &entity.User{Username: "log-admin", Name: "Admin Reviewer", Role: entity.RoleAdmin}
	te.createTestUser(t, author)
	te.createTestUser(t, admin)
	adminToken := te.issueTestToken(t, admin)

	content := &entity.Content{
		ID:           entity.ID(),
		AuthorID:     author.ID,
		Title:        "Log Target",
		Type:         entity.ContentTypeArticle,
		Category:     "test",
		Status:       entity.ContentStatusPublished,
		ReviewStatus: entity.ContentReviewStatusPending,
		Visibility:   entity.ContentVisibilityPrivate,
	}
	if err := te.db.Create(content).Error; err != nil {
		t.Fatalf("seed content: %v", err)
	}
	entry := &entity.ContentModerationLog{
		ID:                   entity.ID(),
		ContentID:            content.ID,
		ReviewerID:           admin.ID,
		PreviousReviewStatus: entity.ContentReviewStatusPending,
		NewReviewStatus:      entity.ContentReviewStatusApproved,
		PreviousVisibility:   entity.ContentVisibilityPrivate,
		NewVisibility:        entity.ContentVisibilityPublic,
		ReviewNote:           "Looks good",
	}
	if err := te.db.Create(entry).Error; err != nil {
		t.Fatalf("seed moderation log: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/contents/"+content.ID+"/moderation-logs", nil)
	req.AddCookie(authCookie(adminToken))
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp ListContentModerationLogsResponse
	decodeJSON(t, rec.Body, &resp)
	if len(resp.Items) != 1 {
		t.Fatalf("len(items) = %d, want 1", len(resp.Items))
	}
	if resp.Items[0].Reviewer == nil || resp.Items[0].Reviewer.Username != admin.Username {
		t.Fatalf("reviewer = %#v, want username %q", resp.Items[0].Reviewer, admin.Username)
	}
	if resp.Items[0].ReviewNote != "Looks good" {
		t.Fatalf("review_note = %q, want %q", resp.Items[0].ReviewNote, "Looks good")
	}
}
