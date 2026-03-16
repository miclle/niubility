// Package service provides business logic and database operations.
package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/textencrypt"
	"github.com/xen0n/go-workwx/v2"
)

// Service holds the database connection and provides business logic methods.
type Service struct {
	DB        *gorm.DB
	Wechat    *workwx.WorkwxApp
	Encryptor *textencrypt.Encryptor

	jwtSecret   string
	wechatMutex sync.RWMutex
}

// New creates a new Service instance with the given DSN.
// It auto-generates jwt_secret and encryption_key on first boot, loading them from DB on subsequent boots.
func New(dsn string) (*Service, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := db.AutoMigrate(&entity.User{}, &entity.Content{}, &entity.Setting{}, &entity.Department{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	svc := &Service{DB: db}

	// Initialize encryption key (auto-generate on first boot)
	encKey, err := svc.ensureSetting(entity.SettingEncryptionKey, func() (string, error) {
		return generateHexKey(32)
	})
	if err != nil {
		return nil, fmt.Errorf("ensure encryption key: %w", err)
	}

	enc, err := textencrypt.NewEncryptor(encKey)
	if err != nil {
		return nil, fmt.Errorf("create encryptor: %w", err)
	}
	svc.Encryptor = enc
	fmt.Println("[Service] Encryptor initialized")

	// Initialize JWT secret (auto-generate on first boot)
	jwtSecret, err := svc.ensureSetting(entity.SettingJWTSecret, func() (string, error) {
		return generateHexKey(64)
	})
	if err != nil {
		return nil, fmt.Errorf("ensure jwt secret: %w", err)
	}
	svc.jwtSecret = jwtSecret
	fmt.Println("[Service] JWT secret loaded")

	// Initialize WeChat client from database config
	wechatApp := svc.initWechatClient()
	svc.Wechat = wechatApp

	return svc, nil
}

// GetJWTSecret returns the JWT signing secret.
func (s *Service) GetJWTSecret() string {
	return s.jwtSecret
}

// IsInitialized checks whether the system has been initialized with a super admin.
func (s *Service) IsInitialized() bool {
	val, err := s.GetSetting(entity.SettingInitialized)
	if err != nil {
		return false
	}
	return val == "true"
}

// IsRegistrationEnabled checks whether user self-registration is enabled.
func (s *Service) IsRegistrationEnabled() bool {
	val, err := s.GetSetting(entity.SettingRegistrationEnabled)
	if err != nil {
		return false
	}
	return val == "true"
}

// IsSSOEnabled checks whether SSO login is enabled.
func (s *Service) IsSSOEnabled() bool {
	val, err := s.GetSetting(entity.SettingSSOEnabled)
	if err != nil {
		return false
	}
	return val == "true"
}

// IsCookieSecure checks whether the Secure flag should be set on cookies.
func (s *Service) IsCookieSecure() bool {
	val, err := s.GetSetting(entity.SettingCookieSecure)
	if err != nil {
		return false
	}
	return val == "true"
}

// ensureSetting ensures a setting key exists in the database.
// If not present, it calls the generator to create a value and stores it.
func (s *Service) ensureSetting(key string, generate func() (string, error)) (string, error) {
	var setting entity.Setting
	err := s.DB.Where("key = ?", key).First(&setting).Error
	if err == nil {
		return setting.Value, nil
	}

	val, err := generate()
	if err != nil {
		return "", fmt.Errorf("generate value for %s: %w", key, err)
	}

	setting = entity.Setting{Key: key, Value: val}
	if err := s.DB.Create(&setting).Error; err != nil {
		// Another instance may have created it concurrently, try reading again
		if err := s.DB.Where("key = ?", key).First(&setting).Error; err != nil {
			return "", fmt.Errorf("get setting %s after create conflict: %w", key, err)
		}
		return setting.Value, nil
	}

	return val, nil
}

// initWechatClient initializes the WeChat client from database config.
func (s *Service) initWechatClient() *workwx.WorkwxApp {
	dbCfg, err := s.GetWechatConfig()
	if err == nil && dbCfg != nil && dbCfg.CorpID != "" {
		fmt.Printf("[Service] Initializing WeChat client from database: CorpID=%s\n", dbCfg.CorpID)
		return workwx.New(dbCfg.CorpID).WithApp(dbCfg.AppSecret, dbCfg.AppAgentID)
	}

	fmt.Println("[Service] WeChat client not initialized: no valid configuration found")
	return nil
}

// RefreshWechatClient re-initializes the WeChat client from database settings.
// Call this after updating WeChat configuration in the database.
func (s *Service) RefreshWechatClient() error {
	s.wechatMutex.Lock()
	defer s.wechatMutex.Unlock()

	dbCfg, err := s.GetWechatConfig()
	if err != nil {
		return fmt.Errorf("get wechat config from database: %w", err)
	}

	if dbCfg == nil || dbCfg.CorpID == "" {
		s.Wechat = nil
		fmt.Println("[Service] WeChat client disabled: no configuration in database")
		return nil
	}

	s.Wechat = workwx.New(dbCfg.CorpID).WithApp(dbCfg.AppSecret, dbCfg.AppAgentID)
	fmt.Printf("[Service] WeChat client refreshed: CorpID=%s\n", dbCfg.CorpID)
	return nil
}

// generateHexKey generates a random key of n bytes and returns it as a hex string.
func generateHexKey(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}
	return hex.EncodeToString(b), nil
}
