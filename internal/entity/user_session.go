package entity

import "time"

// ClientType identifies the type of client that created a session.
type ClientType string

const (
	ClientTypeWeb ClientType = "web"
	ClientTypeCLI ClientType = "cli"
)

// UserSession stores audit-friendly metadata for an authenticated session.
type UserSession struct {
	ID            string     `json:"id"              gorm:"column:id;primaryKey;size:36"`
	UserID        string     `json:"user_id"         gorm:"column:user_id;size:36;index:idx_user_sessions_user_id"`
	ClientType    ClientType `json:"client_type"     gorm:"column:client_type;size:16;index:idx_user_sessions_client_type"`
	ClientID      string     `json:"client_id"       gorm:"column:client_id;size:64;index:idx_user_sessions_client_id"`
	ClientName    string     `json:"client_name"     gorm:"column:client_name;size:191"`
	UserAgent     string     `json:"user_agent"      gorm:"column:user_agent;type:text"`
	IPAddress     string     `json:"ip_address"      gorm:"column:ip_address;size:64"`
	LastSeenAt    time.Time  `json:"last_seen_at"    gorm:"column:last_seen_at;index:idx_user_sessions_last_seen_at"`
	LastUserAgent string     `json:"last_user_agent" gorm:"column:last_user_agent;type:text"`
	LastIPAddress string     `json:"last_ip_address" gorm:"column:last_ip_address;size:64"`
	ExpiresAt     time.Time  `json:"expires_at"      gorm:"column:expires_at;index:idx_user_sessions_expires_at"`
	RevokedAt     *time.Time `json:"revoked_at"      gorm:"column:revoked_at;index:idx_user_sessions_revoked_at"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// TableName specifies the database table name for UserSession.
func (UserSession) TableName() string {
	return "user_sessions"
}
