package service

import (
	"context"
	"fmt"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

// SessionAuditInfo carries request/client metadata for session auditing.
type SessionAuditInfo struct {
	ClientType entity.ClientType
	ClientID   string
	ClientName string
	UserAgent  string
	IPAddress  string
}

// CreateUserSession creates a new audited session for a user.
func (s *Service) CreateUserSession(ctx context.Context, userID string, expiresAt time.Time, audit SessionAuditInfo) (*entity.UserSession, error) {
	session := &entity.UserSession{
		ID:            entity.ID(),
		UserID:        userID,
		ClientType:    normalizeClientType(audit.ClientType),
		ClientID:      audit.ClientID,
		ClientName:    audit.ClientName,
		UserAgent:     audit.UserAgent,
		IPAddress:     audit.IPAddress,
		LastSeenAt:    time.Now(),
		LastUserAgent: audit.UserAgent,
		LastIPAddress: audit.IPAddress,
		ExpiresAt:     expiresAt,
	}

	if err := s.db.WithContext(ctx).Create(session).Error; err != nil {
		return nil, fmt.Errorf("create user session: %w", err)
	}

	return session, nil
}

// TouchUserSession refreshes the latest request metadata for an active session.
func (s *Service) TouchUserSession(ctx context.Context, sessionID string, audit SessionAuditInfo) error {
	if sessionID == "" {
		return nil
	}

	now := time.Now()
	updates := map[string]any{
		"last_seen_at":    now,
		"last_user_agent": audit.UserAgent,
		"last_ip_address": audit.IPAddress,
		"updated_at":      now,
	}
	if audit.ClientName != "" {
		updates["client_name"] = audit.ClientName
	}
	if audit.ClientID != "" {
		updates["client_id"] = audit.ClientID
	}
	if audit.ClientType != "" {
		updates["client_type"] = normalizeClientType(audit.ClientType)
	}
	if audit.UserAgent != "" {
		updates["user_agent"] = audit.UserAgent
	}
	if audit.IPAddress != "" {
		updates["ip_address"] = audit.IPAddress
	}

	if err := s.db.WithContext(ctx).
		Model(&entity.UserSession{}).
		Where("id = ? AND revoked_at IS NULL AND expires_at > ?", sessionID, now).
		Updates(updates).Error; err != nil {
		return fmt.Errorf("touch user session: %w", err)
	}

	return nil
}

// RevokeUserSession marks a session as revoked.
func (s *Service) RevokeUserSession(ctx context.Context, sessionID string) error {
	if sessionID == "" {
		return nil
	}

	now := time.Now()
	if err := s.db.WithContext(ctx).
		Model(&entity.UserSession{}).
		Where("id = ? AND revoked_at IS NULL", sessionID).
		Updates(map[string]any{
			"revoked_at": now,
			"updated_at": now,
		}).Error; err != nil {
		return fmt.Errorf("revoke user session: %w", err)
	}

	return nil
}

// GetUserSession returns a session by ID if it exists.
func (s *Service) GetUserSession(ctx context.Context, sessionID string) (*entity.UserSession, error) {
	var session entity.UserSession
	if err := s.db.WithContext(ctx).Where("id = ?", sessionID).First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

// IsUserSessionActive returns whether a session is still valid for authentication.
func (s *Service) IsUserSessionActive(ctx context.Context, sessionID string) bool {
	if sessionID == "" {
		return false
	}

	session, err := s.GetUserSession(ctx, sessionID)
	if err != nil {
		return false
	}
	if session.RevokedAt != nil {
		return false
	}
	return session.ExpiresAt.After(time.Now())
}

func normalizeClientType(clientType entity.ClientType) entity.ClientType {
	switch clientType {
	case entity.ClientTypeCLI:
		return entity.ClientTypeCLI
	default:
		return entity.ClientTypeWeb
	}
}
