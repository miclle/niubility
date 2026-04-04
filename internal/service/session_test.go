package service

import (
	"context"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_CreateTouchAndRevokeUserSession(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{
		ID:       entity.ID(),
		Username: "auditor",
		Name:     "Auditor",
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	session, err := s.CreateUserSession(ctx, user.ID, time.Now().Add(time.Hour), SessionAuditInfo{
		ClientType: entity.ClientTypeCLI,
		ClientID:   "cli-1",
		ClientName: "MacBook",
		UserAgent:  "niubility-cli/test",
		IPAddress:  "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("CreateUserSession() error = %v", err)
	}

	if session.ClientType != entity.ClientTypeCLI {
		t.Fatalf("CreateUserSession() client_type = %q, want %q", session.ClientType, entity.ClientTypeCLI)
	}

	if err := s.TouchUserSession(ctx, session.ID, SessionAuditInfo{
		ClientType: entity.ClientTypeCLI,
		ClientID:   "cli-1",
		ClientName: "Office MacBook",
		UserAgent:  "niubility-cli/test2",
		IPAddress:  "10.0.0.2",
	}); err != nil {
		t.Fatalf("TouchUserSession() error = %v", err)
	}

	stored, err := s.GetUserSession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetUserSession() error = %v", err)
	}
	if stored.LastIPAddress != "10.0.0.2" {
		t.Fatalf("LastIPAddress = %q, want %q", stored.LastIPAddress, "10.0.0.2")
	}
	if stored.ClientName != "Office MacBook" {
		t.Fatalf("ClientName = %q, want %q", stored.ClientName, "Office MacBook")
	}

	if err := s.RevokeUserSession(ctx, session.ID); err != nil {
		t.Fatalf("RevokeUserSession() error = %v", err)
	}

	stored, err = s.GetUserSession(ctx, session.ID)
	if err != nil {
		t.Fatalf("GetUserSession() after revoke error = %v", err)
	}
	if stored.RevokedAt == nil {
		t.Fatal("RevokedAt = nil, want revoked timestamp")
	}
}
