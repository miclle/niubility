package service

import (
	"context"
	"strconv"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/textencrypt"
)

// sensitiveKeys are setting keys that should be encrypted in storage.
var sensitiveKeys = map[string]bool{
	entity.SettingWechatAppSecret:       true,
	entity.SettingSSOOIDCClientSecret:   true,
	entity.SettingSSOSAMLIDPCertificate: true,
	entity.SettingS3SecretKey:           true,
}

// GetSetting retrieves a setting value by key.
// Automatically decrypts sensitive values if encryption is enabled.
func (s *Service) GetSetting(ctx context.Context, key string) (string, error) {
	log := logger.NewWithContext(ctx)

	var settings []entity.Setting
	if err := s.db.WithContext(ctx).Where(map[string]any{"key": key}).Limit(1).Find(&settings).Error; err != nil {
		log.Errorf("GetSetting: failed to query setting %s: %v", key, err)
		return "", err
	}
	if len(settings) == 0 {
		return "", nil
	}
	setting := settings[0]

	// Decrypt if it's a sensitive key and encryption is enabled
	if sensitiveKeys[key] && s.Encryptor != nil && textencrypt.IsEncrypted(setting.Value) {
		decrypted, err := s.Encryptor.Decrypt(setting.Value)
		if err != nil {
			log.Errorf("GetSetting: failed to decrypt setting %s: %v", key, err)
			return "", err
		}
		return decrypted, nil
	}

	return setting.Value, nil
}

// SetSetting creates or updates a setting value.
// Automatically encrypts sensitive values if encryption is enabled.
func (s *Service) SetSetting(ctx context.Context, key, value string) error {
	log := logger.NewWithContext(ctx)

	// Encrypt if it's a sensitive key and encryption is enabled
	if sensitiveKeys[key] && s.Encryptor != nil && value != "" {
		encrypted, err := s.Encryptor.Encrypt(value)
		if err != nil {
			log.Errorf("SetSetting: failed to encrypt setting %s: %v", key, err)
			return err
		}
		value = encrypted
	}

	setting := entity.Setting{
		Key:   key,
		Value: value,
	}
	if err := s.db.WithContext(ctx).Save(&setting).Error; err != nil {
		log.Errorf("SetSetting: failed to save setting %s: %v", key, err)
		return err
	}
	return nil
}

// ListSettings retrieves all settings from the database.
// Sensitive values are masked for security.
func (s *Service) ListSettings(ctx context.Context) ([]entity.Setting, error) {
	log := logger.NewWithContext(ctx)

	var settings []entity.Setting
	if err := s.db.WithContext(ctx).Find(&settings).Error; err != nil {
		log.Errorf("ListSettings: failed to list settings: %v", err)
		return nil, err
	}

	// Mask sensitive values
	for i := range settings {
		if sensitiveKeys[settings[i].Key] {
			if settings[i].Value != "" {
				settings[i].Value = "******"
			}
		}
	}

	return settings, nil
}

// UpdateSettingsBatch updates multiple settings in a single transaction.
// Automatically encrypts sensitive values if encryption is enabled.
func (s *Service) UpdateSettingsBatch(ctx context.Context, settings map[string]string) error {
	log := logger.NewWithContext(ctx)

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for key, value := range settings {
			// Encrypt if it's a sensitive key and encryption is enabled
			if sensitiveKeys[key] && s.Encryptor != nil && value != "" {
				encrypted, err := s.Encryptor.Encrypt(value)
				if err != nil {
					log.Errorf("UpdateSettingsBatch: failed to encrypt setting %s: %v", key, err)
					return err
				}
				value = encrypted
			}

			setting := entity.Setting{
				Key:   key,
				Value: value,
			}
			if err := tx.Save(&setting).Error; err != nil {
				log.Errorf("UpdateSettingsBatch: failed to save setting %s: %v", key, err)
				return err
			}
		}
		return nil
	})
}

// GetWechatConfig retrieves the WeChat Work configuration from settings.
// Returns nil if CorpID is not configured.
func (s *Service) GetWechatConfig(ctx context.Context) (*entity.WechatConfig, error) {
	corpID, err := s.GetSetting(ctx, entity.SettingWechatCorpID)
	if err != nil || corpID == "" {
		return nil, err
	}

	appSecret, _ := s.GetSetting(ctx, entity.SettingWechatAppSecret)

	appAgentIDStr, _ := s.GetSetting(ctx, entity.SettingWechatAppAgentID)
	appAgentID, _ := strconv.ParseInt(appAgentIDStr, 10, 64)

	return &entity.WechatConfig{
		CorpID:     corpID,
		AppAgentID: appAgentID,
		AppSecret:  appSecret,
	}, nil
}

// GetOIDCConfig retrieves the OIDC configuration from settings.
// Returns nil if issuer is not configured.
func (s *Service) GetOIDCConfig(ctx context.Context) (*entity.OIDCConfig, error) {
	issuer, err := s.GetSetting(ctx, entity.SettingSSOOIDCIssuer)
	if err != nil || issuer == "" {
		return nil, err
	}

	clientID, _ := s.GetSetting(ctx, entity.SettingSSOOIDCClientID)
	clientSecret, _ := s.GetSetting(ctx, entity.SettingSSOOIDCClientSecret)

	return &entity.OIDCConfig{
		Issuer:       issuer,
		ClientID:     clientID,
		ClientSecret: clientSecret,
	}, nil
}

// GetSAMLConfig retrieves the SAML 2.0 configuration from settings.
// Returns nil if IdP SSO URL is not configured.
func (s *Service) GetSAMLConfig(ctx context.Context) (*entity.SAMLConfig, error) {
	ssoURL, err := s.GetSetting(ctx, entity.SettingSSOSAMLIDPSSOURL)
	if err != nil || ssoURL == "" {
		return nil, err
	}

	metadataURL, _ := s.GetSetting(ctx, entity.SettingSSOSAMLIDPMetadataURL)
	entityID, _ := s.GetSetting(ctx, entity.SettingSSOSAMLIDPEntityID)
	certificate, _ := s.GetSetting(ctx, entity.SettingSSOSAMLIDPCertificate)

	return &entity.SAMLConfig{
		IDPMetadataURL: metadataURL,
		IDPEntityID:    entityID,
		IDPSSOURL:      ssoURL,
		IDPCertificate: certificate,
	}, nil
}

// GetS3Config retrieves the S3 storage configuration from settings.
// Returns nil if endpoint is not configured.
func (s *Service) GetS3Config(ctx context.Context) (*entity.S3Config, error) {
	endpoint, err := s.GetSetting(ctx, entity.SettingS3Endpoint)
	if err != nil || endpoint == "" {
		return nil, err
	}

	region, _ := s.GetSetting(ctx, entity.SettingS3Region)
	bucket, _ := s.GetSetting(ctx, entity.SettingS3Bucket)
	accessKey, _ := s.GetSetting(ctx, entity.SettingS3AccessKey)
	secretKey, _ := s.GetSetting(ctx, entity.SettingS3SecretKey)
	publicURL, _ := s.GetSetting(ctx, entity.SettingS3PublicURL)

	return &entity.S3Config{
		Endpoint:  endpoint,
		Region:    region,
		Bucket:    bucket,
		AccessKey: accessKey,
		SecretKey: secretKey,
		PublicURL: publicURL,
	}, nil
}
