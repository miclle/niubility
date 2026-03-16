package entity

import "time"

// Setting represents a key-value configuration entry stored in the database.
// This allows dynamic configuration management without modifying YAML files.
type Setting struct {
	Key       string    `json:"key"        gorm:"column:key;primaryKey;size:64"`
	Value     string    `json:"value"      gorm:"column:value;type:text"`
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at"`
}

// TableName specifies the database table name for Setting.
func (Setting) TableName() string {
	return "settings"
}

// System setting key constants.
const (
	// SettingJWTSecret is the JWT signing secret (auto-generated on first boot).
	SettingJWTSecret = "jwt_secret"
	// SettingEncryptionKey is the AES-256-GCM encryption key (auto-generated on first boot).
	SettingEncryptionKey = "encryption_key"
	// SettingCookieSecure controls whether cookies use the Secure flag.
	SettingCookieSecure = "cookie_secure"
	// SettingInitialized indicates whether the system has been initialized with a super admin.
	SettingInitialized = "initialized"
	// SettingRegistrationEnabled controls whether user self-registration is allowed.
	SettingRegistrationEnabled = "registration_enabled"
	// SettingSSOEnabled controls whether SSO login is available.
	SettingSSOEnabled = "sso_enabled"
	// SettingSSOHost is the SSO provider host URL.
	SettingSSOHost = "sso_host"
	// SettingSSOClientID is the SSO client ID.
	SettingSSOClientID = "sso_client_id"
	// SettingSSOSecret is the SSO secret key.
	SettingSSOSecret = "sso_secret"
)

// Setting key constants for WeChat configuration.
const (
	SettingWechatCorpID     = "wechat.corp_id"
	SettingWechatAppAgentID = "wechat.app_agentid"
	SettingWechatAppSecret  = "wechat.app_secret"
)

// WechatConfig represents the WeChat Work configuration extracted from settings.
type WechatConfig struct {
	CorpID     string
	AppAgentID int64
	AppSecret  string
}
