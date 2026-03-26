package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_GetUserByUsername(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create test user
	user := &entity.User{
		ID:       entity.ID(),
		Username: "testuser",
		Email:    "test@example.com",
		Name:     "Test User",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Test getting existing user
	got, err := s.GetUserByUsername(ctx, "testuser")
	if err != nil {
		t.Fatalf("GetUserByUsername() error = %v", err)
	}
	if got == nil {
		t.Fatal("GetUserByUsername() returned nil")
	}
	if got.Username != "testuser" {
		t.Errorf("Username = %q, want %q", got.Username, "testuser")
	}

	// Test getting non-existent user
	got, err = s.GetUserByUsername(ctx, "nonexistent")
	if err != nil {
		t.Fatalf("GetUserByUsername() error = %v", err)
	}
	if got != nil {
		t.Errorf("GetUserByUsername() = %v, want nil", got)
	}
}

func TestService_GetUserByID(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create test user
	user := &entity.User{
		ID:       entity.ID(),
		Username: "testuser",
		Email:    "test@example.com",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Test getting existing user
	got, err := s.GetUserByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetUserByID() error = %v", err)
	}
	if got == nil {
		t.Fatal("GetUserByID() returned nil")
	}
	if got.ID != user.ID {
		t.Errorf("ID = %q, want %q", got.ID, user.ID)
	}

	// Test getting non-existent user
	got, err = s.GetUserByID(ctx, "nonexistent-id")
	if err != nil {
		t.Fatalf("GetUserByID() error = %v", err)
	}
	if got != nil {
		t.Errorf("GetUserByID() = %v, want nil", got)
	}
}

func TestService_CreateUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		Username: "newuser",
		Email:    "new@example.com",
		Name:     "New User",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}

	if err := s.CreateUser(ctx, user); err != nil {
		t.Fatalf("CreateUser() error = %v", err)
	}

	if user.ID == "" {
		t.Error("CreateUser() should set user.ID")
	}

	// Verify user was created
	got, err := s.GetUserByUsername(ctx, "newuser")
	if err != nil {
		t.Fatalf("GetUserByUsername() error = %v", err)
	}
	if got == nil {
		t.Fatal("User was not created")
	}
}

func TestService_UpdateUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create test user
	user := &entity.User{
		ID:       entity.ID(),
		Username: "updatetest",
		Email:    "update@example.com",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Update role
	adminRole := entity.RoleAdmin
	updated, err := s.UpdateUser(ctx, user.ID, entity.UpdateUserArgs{Role: &adminRole})
	if err != nil {
		t.Fatalf("UpdateUser() error = %v", err)
	}
	if updated.Role != entity.RoleAdmin {
		t.Errorf("Role = %q, want %q", updated.Role, entity.RoleAdmin)
	}

	// Update status
	deactivatedStatus := entity.UserStatusDeactivated
	updated, err = s.UpdateUser(ctx, user.ID, entity.UpdateUserArgs{Status: &deactivatedStatus})
	if err != nil {
		t.Fatalf("UpdateUser() error = %v", err)
	}
	if updated.Status != entity.UserStatusDeactivated {
		t.Errorf("Status = %q, want %q", updated.Status, entity.UserStatusDeactivated)
	}

	// Update non-existent user
	updated, err = s.UpdateUser(ctx, "nonexistent-id", entity.UpdateUserArgs{Role: &adminRole})
	if err != nil {
		t.Fatalf("UpdateUser() error = %v", err)
	}
	if updated != nil {
		t.Errorf("UpdateUser() = %v, want nil", updated)
	}
}

func TestService_UpsertUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// First user should become admin
	user, err := s.UpsertUser(ctx, "firstuser", "first@example.com")
	if err != nil {
		t.Fatalf("UpsertUser() error = %v", err)
	}
	if user.Role != entity.RoleAdmin {
		t.Errorf("First user Role = %q, want %q", user.Role, entity.RoleAdmin)
	}

	// Second user should be regular user
	user2, err := s.UpsertUser(ctx, "seconduser", "second@example.com")
	if err != nil {
		t.Fatalf("UpsertUser() error = %v", err)
	}
	if user2.Role != entity.RoleUser {
		t.Errorf("Second user Role = %q, want %q", user2.Role, entity.RoleUser)
	}

	// Upsert existing user should update
	user3, err := s.UpsertUser(ctx, "firstuser", "updated@example.com")
	if err != nil {
		t.Fatalf("UpsertUser() error = %v", err)
	}
	if user3.Email != "updated@example.com" {
		t.Errorf("Email = %q, want %q", user3.Email, "updated@example.com")
	}
}

func TestService_ListUsers(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create test users
	users := []*entity.User{
		{ID: entity.ID(), Username: "user1", Email: "user1@example.com", Name: "User One", Role: entity.RoleUser, Status: entity.UserStatusActivated},
		{ID: entity.ID(), Username: "user2", Email: "user2@example.com", Name: "User Two", Role: entity.RoleUser, Status: entity.UserStatusActivated},
		{ID: entity.ID(), Username: "admin1", Email: "admin1@example.com", Name: "Admin One", Role: entity.RoleAdmin, Status: entity.UserStatusActivated},
	}
	for _, u := range users {
		if err := s.db.Create(u).Error; err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}
	}

	// List all users
	got, total, _, err := s.ListUsers(ctx, entity.ListUsersArgs{Pagination: entity.Pagination{Limit: 10}})
	if err != nil {
		t.Fatalf("ListUsers() error = %v", err)
	}
	if total != 3 {
		t.Errorf("total = %d, want 3", total)
	}
	if len(got) != 3 {
		t.Errorf("len(got) = %d, want 3", len(got))
	}

	// Note: Search test skipped for SQLite because SQLite doesn't support ILIKE syntax.
	// The search functionality should be tested with PostgreSQL in integration tests.
}
