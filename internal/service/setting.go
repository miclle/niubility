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
	entity.SettingWechatAppSecret:     true,
	entity.SettingSSOOIDCClientSecret: true,
	entity.SettingS3SecretKey:         true,
	entity.SettingSSOSAMLSPPrivateKey: true,
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

// UpdateSettingsWithSideEffects updates settings and triggers related service refreshes.
// If WeChat-related keys are updated, it refreshes the WeChat client.
// If S3-related keys are updated, it re-configures S3 CORS.
// Side-effect failures are logged but do not cause the method to return an error,
// because the settings themselves were already persisted.
func (s *Service) UpdateSettingsWithSideEffects(ctx context.Context, settings map[string]string) error {
	log := logger.NewWithContext(ctx)

	if err := s.UpdateSettingsBatch(ctx, settings); err != nil {
		return err
	}

	// Refresh WeChat client if WeChat keys changed
	wechatKeys := []string{
		entity.SettingWechatCorpID,
		entity.SettingWechatAppAgentID,
		entity.SettingWechatAppSecret,
	}
	for _, key := range wechatKeys {
		if _, ok := settings[key]; ok {
			if err := s.RefreshWechatClient(ctx); err != nil {
				log.Warnf("UpdateSettingsWithSideEffects: refresh wechat client: %v", err)
			}
			break
		}
	}

	// Configure S3 CORS if S3 keys changed
	s3Keys := []string{
		entity.SettingS3Endpoint,
		entity.SettingS3Region,
		entity.SettingS3Bucket,
		entity.SettingS3AccessKey,
		entity.SettingS3SecretKey,
		entity.SettingS3CORSOrigin,
	}
	for _, key := range s3Keys {
		if _, ok := settings[key]; ok {
			if err := s.ConfigureS3CORS(ctx); err != nil {
				log.Warnf("UpdateSettingsWithSideEffects: configure S3 CORS: %v", err)
			}
			break
		}
	}

	return nil
}

// GetWechatConfig retrieves the WeChat Work configuration from settings.
// Returns nil if CorpID is not configured.
func (s *Service) GetWechatConfig(ctx context.Context) (*entity.WechatConfig, error) {
	corpID, err := s.GetSetting(ctx, entity.SettingWechatCorpID)
	if err != nil || corpID == "" {
		return nil, err
	}
	m := s.loadSettings(ctx, entity.SettingWechatAppSecret, entity.SettingWechatAppAgentID)
	appAgentID, _ := strconv.ParseInt(m[entity.SettingWechatAppAgentID], 10, 64)
	return &entity.WechatConfig{
		CorpID:     corpID,
		AppAgentID: appAgentID,
		AppSecret:  m[entity.SettingWechatAppSecret],
	}, nil
}

// GetOIDCConfig retrieves the OIDC configuration from settings.
// Returns nil if issuer is not configured.
func (s *Service) GetOIDCConfig(ctx context.Context) (*entity.OIDCConfig, error) {
	issuer, err := s.GetSetting(ctx, entity.SettingSSOOIDCIssuer)
	if err != nil || issuer == "" {
		return nil, err
	}
	m := s.loadSettings(ctx, entity.SettingSSOOIDCClientID, entity.SettingSSOOIDCClientSecret)
	return &entity.OIDCConfig{
		Issuer:       issuer,
		ClientID:     m[entity.SettingSSOOIDCClientID],
		ClientSecret: m[entity.SettingSSOOIDCClientSecret],
	}, nil
}

// GetSAMLConfig retrieves the SAML 2.0 configuration from settings.
// If IdP Metadata URL is provided, it fetches and parses the metadata to get EntityID, SSO URL, and Certificate.
// Returns nil if IdP Metadata URL is not configured.
func (s *Service) GetSAMLConfig(ctx context.Context) (*entity.SAMLConfig, error) {
	metadataURL, err := s.GetSetting(ctx, entity.SettingSSOSAMLIDPMetadataURL)
	if err != nil || metadataURL == "" {
		return nil, err
	}
	m := s.loadSettings(ctx,
		entity.SettingSSOSAMLSPCertificate, entity.SettingSSOSAMLSPPrivateKey,
		entity.SettingSSOSAMLNameIDFormat, entity.SettingSSOSAMLAttributeMapping,
	)
	return &entity.SAMLConfig{
		IDPMetadataURL:   metadataURL,
		SPCertificate:    m[entity.SettingSSOSAMLSPCertificate],
		SPPrivateKey:     m[entity.SettingSSOSAMLSPPrivateKey],
		NameIDFormat:     m[entity.SettingSSOSAMLNameIDFormat],
		AttributeMapping: m[entity.SettingSSOSAMLAttributeMapping],
	}, nil
}

// GetS3Config retrieves the S3 storage configuration from settings.
// Returns nil if endpoint is not configured.
func (s *Service) GetS3Config(ctx context.Context) (*entity.S3Config, error) {
	endpoint, err := s.GetSetting(ctx, entity.SettingS3Endpoint)
	if err != nil || endpoint == "" {
		return nil, err
	}
	m := s.loadSettings(ctx,
		entity.SettingS3Region, entity.SettingS3Bucket,
		entity.SettingS3AccessKey, entity.SettingS3SecretKey,
		entity.SettingS3PublicURL, entity.SettingS3CORSOrigin,
	)
	return &entity.S3Config{
		Endpoint:   endpoint,
		Region:     m[entity.SettingS3Region],
		Bucket:     m[entity.SettingS3Bucket],
		AccessKey:  m[entity.SettingS3AccessKey],
		SecretKey:  m[entity.SettingS3SecretKey],
		PublicURL:  m[entity.SettingS3PublicURL],
		CORSOrigin: m[entity.SettingS3CORSOrigin],
	}, nil
}

// GetDeliveryConfig retrieves the asset delivery configuration from settings.
// Returns nil when delivery is not configured.
func (s *Service) GetDeliveryConfig(ctx context.Context) (*entity.DeliveryConfig, error) {
	provider, err := s.GetSetting(ctx, entity.SettingDeliveryProvider)
	if err != nil || provider == "" || provider == "disabled" {
		return nil, err
	}
	m := s.loadSettings(ctx,
		entity.SettingDeliveryDomain, entity.SettingDeliveryPrivateEnabled,
		entity.SettingDeliveryURLTTLSeconds, entity.SettingDeliveryStyleMode,
	)
	privateEnabledBool, _ := strconv.ParseBool(m[entity.SettingDeliveryPrivateEnabled])
	urlTTLSecondsInt, _ := strconv.Atoi(m[entity.SettingDeliveryURLTTLSeconds])
	if urlTTLSecondsInt <= 0 {
		urlTTLSecondsInt = 3600
	}
	styleMode := m[entity.SettingDeliveryStyleMode]
	if styleMode == "" {
		styleMode = "auto"
	}
	return &entity.DeliveryConfig{
		Provider:       provider,
		Domain:         m[entity.SettingDeliveryDomain],
		PrivateEnabled: privateEnabledBool,
		URLTTLSeconds:  urlTTLSecondsInt,
		StyleMode:      styleMode,
	}, nil
}

// GetBackupConfig retrieves the database backup behavior configuration from settings.
// Returns defaults when values are missing.
func (s *Service) GetBackupConfig(ctx context.Context) (*entity.BackupConfig, error) {
	s3Prefix, err := s.GetSetting(ctx, entity.SettingBackupDatabaseS3Prefix)
	if err != nil {
		return nil, err
	}
	if s3Prefix == "" {
		s3Prefix = "backups/database"
	}

	ttlSeconds, err := s.GetSetting(ctx, entity.SettingBackupDatabaseDownloadURLTTLSeconds)
	if err != nil {
		return nil, err
	}
	downloadURLTTLSeconds, parseErr := strconv.Atoi(ttlSeconds)
	if parseErr != nil || downloadURLTTLSeconds <= 0 {
		downloadURLTTLSeconds = 900
	}

	return &entity.BackupConfig{
		S3Prefix:              s3Prefix,
		DownloadURLTTLSeconds: downloadURLTTLSeconds,
	}, nil
}

func (s *Service) getSettingWithFallback(ctx context.Context, key string, fallbackKeys ...string) string {
	value, _ := s.GetSetting(ctx, key)
	if value != "" {
		return value
	}
	for _, fallbackKey := range fallbackKeys {
		value, _ = s.GetSetting(ctx, fallbackKey)
		if value != "" {
			return value
		}
	}
	return ""
}

// loadSettings reads multiple setting keys and returns them as a map.
func (s *Service) loadSettings(ctx context.Context, keys ...string) map[string]string {
	m := make(map[string]string, len(keys))
	for _, key := range keys {
		m[key], _ = s.GetSetting(ctx, key)
	}
	return m
}

// GetSiteConfig retrieves the site-level configuration from settings.
// Returns a config with default values.
func (s *Service) GetSiteConfig(ctx context.Context) (*entity.SiteConfig, error) {
	title, _ := s.GetSetting(ctx, entity.SettingSiteTitle)
	if title == "" {
		title = "Niubility"
	}
	description, _ := s.GetSetting(ctx, entity.SettingSiteDescription)
	keywords, _ := s.GetSetting(ctx, entity.SettingSiteKeywords)
	version, _ := s.GetSetting(ctx, entity.SettingSiteVersion)
	faviconURL, _ := s.GetSetting(ctx, entity.SettingSiteFaviconURL)
	logoURL, _ := s.GetSetting(ctx, entity.SettingSiteLogoURL)
	copyright, _ := s.GetSetting(ctx, entity.SettingSiteCopyright)
	if copyright == "" {
		copyright = "Niubility"
	}
	forceHTTPS, _ := s.GetSetting(ctx, entity.SettingSiteForceHTTPS)
	forceHTTPSBool, _ := strconv.ParseBool(forceHTTPS)
	footer, _ := s.GetSetting(ctx, entity.SettingSiteFooter)
	videoDefaultCoverURL, _ := s.GetSetting(ctx, entity.SettingSiteVideoDefaultCoverURL)
	videoSpeakerDefaultAvatarURL, _ := s.GetSetting(ctx, entity.SettingSiteVideoSpeakerDefaultAvatarURL)
	videoCardImageStyle, _ := s.GetSetting(ctx, entity.SettingDeliveryVideoCardImageStyle)
	galleryCardImageStyle := s.getSettingWithFallback(ctx, entity.SettingDeliveryGalleryCardImageStyle, entity.SettingSiteGalleryCardImageStyle)
	galleryOriginalImageStyle, _ := s.GetSetting(ctx, entity.SettingDeliveryGalleryOriginalImageStyle)
	galleryDetailImageStyle := s.getSettingWithFallback(ctx, entity.SettingDeliveryGalleryDetailImageStyle, entity.SettingSiteGalleryDetailImageStyle)
	avatarImageStyle := s.getSettingWithFallback(ctx, entity.SettingDeliveryAvatarImageStyle, entity.SettingSiteAvatarImageStyle)

	return &entity.SiteConfig{
		Title:                        title,
		Description:                  description,
		Keywords:                     keywords,
		Version:                      version,
		FaviconURL:                   faviconURL,
		LogoURL:                      logoURL,
		Copyright:                    copyright,
		ForceHTTPS:                   forceHTTPSBool,
		Footer:                       footer,
		VideoDefaultCoverURL:         videoDefaultCoverURL,
		VideoSpeakerDefaultAvatarURL: videoSpeakerDefaultAvatarURL,
		VideoCardImageStyle:          videoCardImageStyle,
		GalleryCardImageStyle:        galleryCardImageStyle,
		GalleryOriginalImageStyle:    galleryOriginalImageStyle,
		GalleryDetailImageStyle:      galleryDetailImageStyle,
		AvatarImageStyle:             avatarImageStyle,
	}, nil
}
