package service

import (
	"strconv"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// GetSetting retrieves a setting value by key.
// Returns empty string if the setting does not exist.
func (s *Service) GetSetting(key string) (string, error) {
	var setting entity.Setting
	if err := s.DB.Where("key = ?", key).First(&setting).Error; err != nil {
		return "", err
	}
	return setting.Value, nil
}

// SetSetting creates or updates a setting value.
func (s *Service) SetSetting(key, value string) error {
	setting := entity.Setting{
		Key:   key,
		Value: value,
	}
	return s.DB.Save(&setting).Error
}

// ListSettings retrieves all settings from the database.
func (s *Service) ListSettings() ([]entity.Setting, error) {
	var settings []entity.Setting
	if err := s.DB.Find(&settings).Error; err != nil {
		return nil, err
	}
	return settings, nil
}

// UpdateSettingsBatch updates multiple settings in a single transaction.
func (s *Service) UpdateSettingsBatch(settings map[string]string) error {
	return s.DB.Transaction(func(tx *gorm.DB) error {
		for key, value := range settings {
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
