// Package service provides business logic and database operations.
package service

import (
	"fmt"
	"sync"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/config"
	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/pkg/textencrypt"
	"github.com/xen0n/go-workwx/v2"
)

// Service holds the database connection and provides business logic methods.
type Service struct {
	DB        *gorm.DB
	Wechat    *workwx.WorkwxApp
	Encryptor *textencrypt.Encryptor

	wechatMutex sync.RWMutex
}

// New creates a new Service instance with the given config.
// WeChat configuration is loaded from database first, falling back to file config.
func New(dsn string, wechatCfg *config.WechatConfig, encryptionKey string) (*Service, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := db.AutoMigrate(&entity.User{}, &entity.Content{}, &entity.Setting{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	svc := &Service{DB: db}

	// Initialize encryptor (required for security)
	if encryptionKey == "" {
		return nil, fmt.Errorf("encryptionKey is required in server config, generate with: openssl rand -hex 32")
	}
	enc, err := textencrypt.NewEncryptor(encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("create encryptor: %w", err)
	}
	svc.Encryptor = enc
	fmt.Println("[Service] Encryptor initialized for sensitive settings")

	// Initialize WeChat client
	wechatApp := svc.initWechatClient(wechatCfg)
	svc.Wechat = wechatApp

	return svc, nil
}

// initWechatClient initializes the WeChat client from database or file config.
// Database config takes priority over file config.
func (s *Service) initWechatClient(fileCfg *config.WechatConfig) *workwx.WorkwxApp {
	// Try to load from database first
	dbCfg, err := s.GetWechatConfig()
	if err == nil && dbCfg != nil && dbCfg.CorpID != "" {
		fmt.Printf("[Service] Initializing WeChat client from database: CorpID=%s\n", dbCfg.CorpID)
		return workwx.New(dbCfg.CorpID).WithApp(dbCfg.AppSecret, dbCfg.AppAgentID)
	}

	// Fall back to file config
	if fileCfg != nil && fileCfg.CorpID != "" {
		fmt.Printf("[Service] Initializing WeChat client from config file: CorpID=%s\n", fileCfg.CorpID)
		return workwx.New(fileCfg.CorpID).WithApp(fileCfg.AppSecret, fileCfg.AppAgentID)
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
