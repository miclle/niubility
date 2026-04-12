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
		ID:       entity.ID(),
		AuthorID: admin.ID,
		Title:    "Test Article",
		Body:     "body text",
		Type:     entity.ContentTypeArticle,
		Status:   entity.ContentStatusPublished,
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
		ID:       entity.ID(),
		AuthorID: user.ID,
		Title:    "Visible Article",
		Body:     "content body",
		Type:     entity.ContentTypeArticle,
		Status:   entity.ContentStatusPublished,
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
		ID:       entity.ID(),
		AuthorID: author.ID,
		Title:    "To Delete",
		Body:     "will be deleted",
		Type:     entity.ContentTypeArticle,
		Status:   entity.ContentStatusPublished,
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
