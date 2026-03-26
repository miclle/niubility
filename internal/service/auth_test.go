package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
	apperrors "github.com/miclle/niubility/internal/errors"
	"golang.org/x/crypto/bcrypt"
)

func TestService_InitSuperAdmin(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user, err := s.InitSuperAdmin(ctx, "admin", "admin@example.com", "password123")
	if err != nil {
		t.Fatalf("InitSuperAdmin() error = %v", err)
	}
	if user == nil {
		t.Fatal("InitSuperAdmin() returned nil user")
	}
	if user.Username != "admin" {
		t.Errorf("Username = %q, want %q", user.Username, "admin")
	}
	if user.Email != "admin@example.com" {
		t.Errorf("Email = %q, want %q", user.Email, "admin@example.com")
	}
	if user.Role != entity.RoleSuperAdmin {
		t.Errorf("Role = %q, want %q", user.Role, entity.RoleSuperAdmin)
	}
	if user.Status != entity.UserStatusActivated {
		t.Errorf("Status = %q, want %q", user.Status, entity.UserStatusActivated)
	}

	// Verify password is hashed
	if user.Password == "password123" {
		t.Error("Password should be hashed, not plaintext")
	}

	// Verify system is marked as initialized
	if !s.IsInitialized(ctx) {
		t.Error("IsInitialized() = false, want true")
	}

	// Second call should fail
	_, err = s.InitSuperAdmin(ctx, "admin2", "admin2@example.com", "password456")
	if err == nil {
		t.Error("InitSuperAdmin() should fail when already initialized")
	}
}

func TestService_RegisterUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user, err := s.RegisterUser(ctx, "testuser", "test@example.com", "password123")
	if err != nil {
		t.Fatalf("RegisterUser() error = %v", err)
	}
	if user == nil {
		t.Fatal("RegisterUser() returned nil user")
	}
	if user.Username != "testuser" {
		t.Errorf("Username = %q, want %q", user.Username, "testuser")
	}
	if user.Email != "test@example.com" {
		t.Errorf("Email = %q, want %q", user.Email, "test@example.com")
	}
	if user.Role != entity.RoleUser {
		t.Errorf("Role = %q, want %q", user.Role, entity.RoleUser)
	}
	if user.Status != entity.UserStatusDeactivated {
		t.Errorf("Status = %q, want %q", user.Status, entity.UserStatusDeactivated)
	}

	// Verify password is hashed
	if user.Password == "password123" {
		t.Error("Password should be hashed, not plaintext")
	}

	// Duplicate username should fail
	_, err = s.RegisterUser(ctx, "testuser", "another@example.com", "password456")
	if err == nil {
		t.Error("RegisterUser() should fail with duplicate username")
	}
}

func TestService_AuthenticateUser(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create a user with known password
	hashed, _ := bcrypt.GenerateFromPassword([]byte("correct_password"), bcrypt.DefaultCost)
	user := &entity.User{
		ID:       entity.ID(),
		Username: "authuser",
		Email:    "auth@example.com",
		Password: string(hashed),
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	tests := []struct {
		name     string
		username string
		password string
		wantErr  bool
	}{
		{"correct credentials", "authuser", "correct_password", false},
		{"wrong password", "authuser", "wrong_password", true},
		{"non-existent user", "nonexistent", "password", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := s.AuthenticateUser(ctx, tt.username, tt.password)
			if tt.wantErr {
				if err == nil {
					t.Error("AuthenticateUser() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("AuthenticateUser() error = %v", err)
			}
			if got.Username != tt.username {
				t.Errorf("Username = %q, want %q", got.Username, tt.username)
			}
		})
	}
}

func TestService_ChangePassword(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create a user with known password
	hashed, _ := bcrypt.GenerateFromPassword([]byte("old_password"), bcrypt.DefaultCost)
	user := &entity.User{
		ID:       entity.ID(),
		Username: "changepwd",
		Email:    "change@example.com",
		Password: string(hashed),
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Test wrong old password
	err := s.ChangePassword(ctx, user.ID, "wrong_old", "new_password")
	if err != apperrors.ErrOldPasswordIncorrect {
		t.Errorf("ChangePassword() error = %v, want %v", err, apperrors.ErrOldPasswordIncorrect)
	}

	// Test correct password change
	err = s.ChangePassword(ctx, user.ID, "old_password", "new_password")
	if err != nil {
		t.Fatalf("ChangePassword() error = %v", err)
	}

	// Verify new password works
	_, err = s.AuthenticateUser(ctx, "changepwd", "new_password")
	if err != nil {
		t.Errorf("AuthenticateUser() with new password error = %v", err)
	}
}

func TestService_HasPassword(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// User with password
	hashed, _ := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	userWithPwd := &entity.User{
		ID:       entity.ID(),
		Username: "withpwd",
		Password: string(hashed),
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(userWithPwd).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// User without password
	userWithoutPwd := &entity.User{
		ID:       entity.ID(),
		Username: "withoutpwd",
		Password: "",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.Create(userWithoutPwd).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	hasPwd, err := s.HasPassword(ctx, userWithPwd.ID)
	if err != nil {
		t.Fatalf("HasPassword() error = %v", err)
	}
	if !hasPwd {
		t.Error("HasPassword() = false for user with password")
	}

	hasPwd, err = s.HasPassword(ctx, userWithoutPwd.ID)
	if err != nil {
		t.Fatalf("HasPassword() error = %v", err)
	}
	if hasPwd {
		t.Error("HasPassword() = true for user without password")
	}
}
