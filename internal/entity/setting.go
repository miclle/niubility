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
	// SettingSSOType controls which SSO protocol is active ("disabled", "oidc", or "saml").
	SettingSSOType = "sso_type"

	// OIDC settings.
	// SettingSSOOIDCIssuer is the OIDC provider issuer URL (e.g. "https://accounts.google.com").
	SettingSSOOIDCIssuer = "sso_oidc_issuer"
	// SettingSSOOIDCClientID is the OIDC client ID.
	SettingSSOOIDCClientID = "sso_oidc_client_id"
	// SettingSSOOIDCClientSecret is the OIDC client secret (encrypted in storage).
	SettingSSOOIDCClientSecret = "sso_oidc_client_secret"

	// SAML settings.
	// SettingSSOSAMLIDPMetadataURL is the SAML IdP metadata URL.
	SettingSSOSAMLIDPMetadataURL = "sso_saml_idp_metadata_url"
	// SettingSSOSAMLSPCertificate is the SP certificate in PEM format (for signing AuthnRequest).
	SettingSSOSAMLSPCertificate = "sso_saml_sp_certificate"
	// SettingSSOSAMLSPPrivateKey is the SP private key in PEM format (encrypted in storage).
	SettingSSOSAMLSPPrivateKey = "sso_saml_sp_private_key"
	// SettingSSOSAMLNameIDFormat is the NameID format (unspecified, email, transient, persistent).
	SettingSSOSAMLNameIDFormat = "sso_saml_nameid_format"
	// SettingSSOSAMLAttributeMapping is the JSON mapping from IdP attributes to system fields.
	SettingSSOSAMLAttributeMapping = "sso_saml_attribute_mapping"
)

// Setting key constants for WeChat configuration.
const (
	SettingWechatCorpID     = "wechat.corp_id"
	SettingWechatAppAgentID = "wechat.app_agentid"
	SettingWechatAppSecret  = "wechat.app_secret"
)

// Setting key constants for S3 storage configuration.
const (
	// SettingS3Endpoint is the S3-compatible endpoint URL.
	SettingS3Endpoint = "s3.endpoint"
	// SettingS3Region is the S3 bucket region.
	SettingS3Region = "s3.region"
	// SettingS3Bucket is the S3 bucket name.
	SettingS3Bucket = "s3.bucket"
	// SettingS3AccessKey is the S3 access key ID.
	SettingS3AccessKey = "s3.access_key"
	// SettingS3SecretKey is the S3 secret access key (encrypted in storage).
	SettingS3SecretKey = "s3.secret_key"
	// SettingS3PublicURL is the optional public URL prefix for accessing uploaded files (e.g., CDN domain).
	SettingS3PublicURL = "s3.public_url"
	// SettingS3CORSOrigin is the allowed CORS origin for browser-based S3 uploads (e.g., "http://localhost:9000").
	SettingS3CORSOrigin = "s3.cors_origin"
)

// WechatConfig represents the WeChat Work configuration extracted from settings.
type WechatConfig struct {
	CorpID     string
	AppAgentID int64
	AppSecret  string
}

// OIDCConfig represents the OIDC configuration extracted from settings.
type OIDCConfig struct {
	Issuer       string
	ClientID     string
	ClientSecret string
}

// SAMLConfig represents the SAML 2.0 configuration extracted from settings.
type SAMLConfig struct {
	// IDPMetadataURL is the IdP metadata URL for auto-discovery.
	IDPMetadataURL string
	// SPCertificate is the SP certificate in PEM format (optional, for signing AuthnRequest).
	SPCertificate string
	// SPPrivateKey is the SP private key in PEM format (optional, encrypted in storage).
	SPPrivateKey string
	// NameIDFormat is the NameID format: unspecified, email, transient, persistent.
	NameIDFormat string
	// AttributeMapping is the JSON mapping from IdP attributes to system fields.
	// Example: {"uid": "username", "mail": "email", "displayName": "name"}
	AttributeMapping string
}

// S3Config represents the S3 storage configuration extracted from settings.
type S3Config struct {
	Endpoint   string
	Region     string
	Bucket     string
	AccessKey  string
	SecretKey  string
	PublicURL  string
	CORSOrigin string
}
