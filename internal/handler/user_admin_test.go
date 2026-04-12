package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestListUsers_AdminOnly(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	admin := &entity.User{
		Username: "admin-lu",
		Name:     "Admin LU",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, admin)
	token := te.issueTestToken(t, admin)

	// Seed another user
	te.createTestUser(t, &entity.User{
		Username: "member-lu",
		Name:     "Member LU",
		Role:     entity.RoleUser,
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("ListUsers status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var resp ListUsersResponse
	decodeJSON(t, rec.Body, &resp)
	if len(resp.Items) < 2 {
		t.Errorf("ListUsers returned %d items, want at least 2", len(resp.Items))
	}
}

func TestListUsers_NonAdminForbidden(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	member := &entity.User{
		Username: "member-forbidden",
		Name:     "Member",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, member)
	token := te.issueTestToken(t, member)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestGetUser(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	admin := &entity.User{
		Username: "admin-gu",
		Name:     "Admin GU",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, admin)
	token := te.issueTestToken(t, admin)

	target := &entity.User{
		Username: "target-gu",
		Name:     "Target User",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, target)

	t.Run("existing user", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/"+target.ID, nil)
		req.AddCookie(authCookie(token))
		rec := te.doRequest(req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
		}

		var user entity.User
		decodeJSON(t, rec.Body, &user)
		if user.Username != "target-gu" {
			t.Errorf("username = %q, want %q", user.Username, "target-gu")
		}
	})

	t.Run("non-existent user", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/nonexistent", nil)
		req.AddCookie(authCookie(token))
		rec := te.doRequest(req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusNotFound)
		}
	})
}

func TestCreateUser_Admin(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	admin := &entity.User{
		Username: "admin-cu",
		Name:     "Admin CU",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, admin)
	token := te.issueTestToken(t, admin)

	args := entity.CreateUserArgs{
		Username: "newuser",
		Email:    "new@example.com",
		Password: strPtr("securepassword123"),
		Name:     strPtr("New User"),
		Role:     rolePtr(entity.RoleUser),
	}
	body, _ := json.Marshal(args)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("CreateUser status = %d, want %d; body = %s", rec.Code, http.StatusOK, rec.Body.String())
	}

	var created entity.User
	decodeJSON(t, rec.Body, &created)
	if created.Username != "newuser" {
		t.Errorf("username = %q, want %q", created.Username, "newuser")
	}
}

func TestDeleteUser_Admin(t *testing.T) {
	te := setupTestEnv(t)
	te.markInitialized(t)

	admin := &entity.User{
		Username: "admin-du",
		Name:     "Admin DU",
		Role:     entity.RoleAdmin,
	}
	te.createTestUser(t, admin)
	token := te.issueTestToken(t, admin)

	target := &entity.User{
		Username: "delete-target",
		Name:     "Delete Target",
		Role:     entity.RoleUser,
	}
	te.createTestUser(t, target)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/users/"+target.ID, nil)
	req.AddCookie(authCookie(token))
	rec := te.doRequest(req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("DeleteUser status = %d, want %d; body = %s", rec.Code, http.StatusNoContent, rec.Body.String())
	}

	// Verify user is deleted
	req = httptest.NewRequest(http.MethodGet, "/api/v1/admin/users/"+target.ID, nil)
	req.AddCookie(authCookie(token))
	rec = te.doRequest(req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("after delete: status = %d, want %d", rec.Code, http.StatusNotFound)
	}
}

func TestHealth(t *testing.T) {
	te := setupTestEnv(t)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := te.doRequest(req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Health status = %d, want %d", rec.Code, http.StatusOK)
	}
	if body := rec.Body.String(); body != "ok" {
		t.Errorf("Health body = %q, want %q", body, "ok")
	}
}
