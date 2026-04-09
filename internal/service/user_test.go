package service

import (
	"context"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/entity"
	"golang.org/x/crypto/bcrypt"
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
		return
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
		return
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
		return
	}
}

func TestService_CreateManagedUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	password := "secret123"
	role := entity.RoleAdmin
	createdAt := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
	updatedAt := time.Date(2024, 2, 3, 4, 5, 6, 0, time.UTC)

	user, err := s.CreateManagedUser(ctx, entity.CreateUserArgs{
		Username:  "managed-user",
		Email:     "managed@example.com",
		Password:  &password,
		Role:      &role,
		CreatedAt: &createdAt,
		UpdatedAt: &updatedAt,
	})
	if err != nil {
		t.Fatalf("CreateManagedUser() error = %v", err)
	}

	if user == nil {
		t.Fatal("CreateManagedUser() returned nil")
		return
	}
	if user.ID == "" {
		t.Error("CreateManagedUser() should set user.ID")
	}
	if user.Name != "managed" {
		t.Errorf("Name = %q, want %q", user.Name, "managed")
	}
	if user.Role != entity.RoleAdmin {
		t.Errorf("Role = %q, want %q", user.Role, entity.RoleAdmin)
	}
	if user.Status != entity.UserStatusActivated {
		t.Errorf("Status = %q, want %q", user.Status, entity.UserStatusActivated)
	}
	if !user.CreatedAt.Equal(createdAt) {
		t.Errorf("CreatedAt = %v, want %v", user.CreatedAt, createdAt)
	}
	if !user.UpdatedAt.Equal(updatedAt) {
		t.Errorf("UpdatedAt = %v, want %v", user.UpdatedAt, updatedAt)
	}
	if user.Password == "" {
		t.Fatal("CreateManagedUser() should store hashed password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		t.Fatalf("stored password hash does not match input: %v", err)
	}

	_, err = s.CreateManagedUser(ctx, entity.CreateUserArgs{
		Username: "managed-user",
		Email:    "another@example.com",
	})
	if err != ErrUserUsernameExists {
		t.Fatalf("CreateManagedUser() duplicate error = %v, want %v", err, ErrUserUsernameExists)
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

	username := "updated-user"
	email := "updated@example.com"
	name := "Updated User"
	password := "new-secret"
	departmentIDs := "1,2"
	socialAccounts := map[string]string{"github": "updated-user"}
	adminRole := entity.RoleAdmin
	createdAt := time.Date(2023, 5, 6, 7, 8, 9, 0, time.UTC)
	updatedAt := time.Date(2025, 6, 7, 8, 9, 10, 0, time.UTC)
	updated, err := s.UpdateUser(ctx, user.ID, entity.UpdateUserArgs{
		Username:       &username,
		Email:          &email,
		Name:           &name,
		Password:       &password,
		DepartmentIDs:  &departmentIDs,
		SocialAccounts: socialAccounts,
		Role:           &adminRole,
		CreatedAt:      &createdAt,
		UpdatedAt:      &updatedAt,
	})
	if err != nil {
		t.Fatalf("UpdateUser() error = %v", err)
	}
	if updated.Username != username {
		t.Errorf("Username = %q, want %q", updated.Username, username)
	}
	if updated.Email != email {
		t.Errorf("Email = %q, want %q", updated.Email, email)
	}
	if updated.Name != name {
		t.Errorf("Name = %q, want %q", updated.Name, name)
	}
	if updated.DepartmentIDs != departmentIDs {
		t.Errorf("DepartmentIDs = %q, want %q", updated.DepartmentIDs, departmentIDs)
	}
	if updated.SocialAccounts["github"] != "updated-user" {
		t.Errorf("SocialAccounts[github] = %q, want %q", updated.SocialAccounts["github"], "updated-user")
	}
	if updated.Role != entity.RoleAdmin {
		t.Errorf("Role = %q, want %q", updated.Role, entity.RoleAdmin)
	}
	if !updated.CreatedAt.Equal(createdAt) {
		t.Errorf("CreatedAt = %v, want %v", updated.CreatedAt, createdAt)
	}
	if !updated.UpdatedAt.Equal(updatedAt) {
		t.Errorf("UpdatedAt = %v, want %v", updated.UpdatedAt, updatedAt)
	}
	if updated.Password == "" {
		t.Fatal("UpdateUser() should store hashed password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(updated.Password), []byte(password)); err != nil {
		t.Fatalf("updated password hash does not match input: %v", err)
	}

	backupAdmin := &entity.User{
		ID:       entity.ID(),
		Username: "backup-admin",
		Email:    "backup-admin@example.com",
		Role:     entity.RoleAdmin,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(backupAdmin).Error; err != nil {
		t.Fatalf("Failed to create backup admin: %v", err)
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

	// Clear password
	emptyPassword := ""
	updated, err = s.UpdateUser(ctx, user.ID, entity.UpdateUserArgs{Password: &emptyPassword})
	if err != nil {
		t.Fatalf("UpdateUser() clear password error = %v", err)
	}
	if updated.Password != "" {
		t.Errorf("Password = %q, want empty string", updated.Password)
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

func TestService_UpdateUser_LastActiveAdminGuard(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	admin := &entity.User{
		ID:       entity.ID(),
		Username: "only-admin",
		Email:    "admin@example.com",
		Role:     entity.RoleAdmin,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(admin).Error; err != nil {
		t.Fatalf("Failed to create admin: %v", err)
	}

	role := entity.RoleUser
	_, err := s.UpdateUser(ctx, admin.ID, entity.UpdateUserArgs{Role: &role})
	if err != ErrUserLastActiveAdmin {
		t.Fatalf("UpdateUser() demote last admin error = %v, want %v", err, ErrUserLastActiveAdmin)
	}

	status := entity.UserStatusDeactivated
	_, err = s.UpdateUser(ctx, admin.ID, entity.UpdateUserArgs{Status: &status})
	if err != ErrUserLastActiveAdmin {
		t.Fatalf("UpdateUser() deactivate last admin error = %v, want %v", err, ErrUserLastActiveAdmin)
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

func TestService_DeleteUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "delete-me",
		Email:    "delete@example.com",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if err := s.DeleteUser(ctx, user.ID); err != nil {
		t.Fatalf("DeleteUser() error = %v", err)
	}

	got, err := s.GetUserByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetUserByID() error = %v", err)
	}
	if got != nil {
		t.Errorf("GetUserByID() after delete = %v, want nil", got)
	}
}

func TestService_DeleteUser_LastActiveAdminGuard(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	admin := &entity.User{
		ID:       entity.ID(),
		Username: "only-admin",
		Email:    "admin@example.com",
		Role:     entity.RoleSuperAdmin,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(admin).Error; err != nil {
		t.Fatalf("Failed to create admin: %v", err)
	}

	err := s.DeleteUser(ctx, admin.ID)
	if err != ErrUserLastActiveAdmin {
		t.Fatalf("DeleteUser() error = %v, want %v", err, ErrUserLastActiveAdmin)
	}
}
