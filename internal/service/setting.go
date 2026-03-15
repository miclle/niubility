package service

import (
	"strconv"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/textencrypt"
)

// sensitiveKeys are setting keys that should be encrypted in storage.
var sensitiveKeys = map[string]bool{
	entity.SettingWechatAppSecret: true,
}

// GetSetting retrieves a setting value by key.
// Automatically decrypts sensitive values if encryption is enabled.
func (s *Service) GetSetting(key string) (string, error) {
	var setting entity.Setting
	if err := s.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		return "", err
	}

	// Decrypt if it's a sensitive key and encryption is enabled
	if sensitiveKeys[key] && s.Encryptor != nil && textencrypt.IsEncrypted(setting.Value) {
		decrypted, err := s.Encryptor.Decrypt(setting.Value)
		if err != nil {
			return "", err
		}
		return decrypted, nil
	}

	return setting.Value, nil
}

// SetSetting creates or updates a setting value.
// Automatically encrypts sensitive values if encryption is enabled.
func (s *Service) SetSetting(key, value string) error {
	// Encrypt if it's a sensitive key and encryption is enabled
	if sensitiveKeys[key] && s.Encryptor != nil && value != "" {
		encrypted, err := s.Encryptor.Encrypt(value)
		if err != nil {
			return err
		}
		value = encrypted
	}

	setting := entity.Setting{
		Key:   key,
		Value: value,
	}
	return s.DB.Save(&setting).Error
}

// ListSettings retrieves all settings from the database.
// Sensitive values are masked for security.
func (s *Service) ListSettings() ([]entity.Setting, error) {
	var settings []entity.Setting
	if err := s.DB.Find(&settings).Error; err != nil {
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
func (s *Service) UpdateSettingsBatch(settings map[string]string) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		for key, value := range settings {
			// Encrypt if it's a sensitive key and encryption is enabled
			if sensitiveKeys[key] && s.Encryptor != nil && value != "" {
				encrypted, err := s.Encryptor.Encrypt(value)
				if err != nil {
					return err
				}
				value = encrypted
			}

			setting := entity.Setting{
				Key:   key,
				Value: value,
			}
			if err := tx.Save(&setting).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// GetWechatConfig retrieves the WeChat Work configuration from settings.
// Returns nil if CorpID is not configured.
func (s *Service) GetWechatConfig() (*entity.WechatConfig, error) {
	corpID, err := s.GetSetting(entity.SettingWechatCorpID)
	if err != nil || corpID == "" {
		return nil, err
	}

	appSecret, _ := s.GetSetting(entity.SettingWechatAppSecret)

	appAgentIDStr, _ := s.GetSetting(entity.SettingWechatAppAgentID)
	appAgentID, _ := strconv.ParseInt(appAgentIDStr, 10, 64)

	return &entity.WechatConfig{
		CorpID:     corpID,
		AppAgentID: appAgentID,
		AppSecret:  appSecret,
	}, nil
}
