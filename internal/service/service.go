// Package service provides business logic and database operations.
package service

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/config"
	"github.com/miclle/niubility/internal/entity"
	"github.com/xen0n/go-workwx/v2"
)

// Service holds the database connection and provides business logic methods.
type Service struct {
	DB     *gorm.DB
	Wechat *workwx.WorkwxApp
}

// New creates a new Service instance with the given database DSN and WeChat config.
func New(dsn string, wechatCfg *config.WechatConfig) (*Service, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := db.AutoMigrate(&entity.User{}, &entity.Content{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	var wechatApp *workwx.WorkwxApp
	fmt.Printf("[Service] WechatConfig: %+v\n", wechatCfg)
	if wechatCfg != nil && wechatCfg.CorpID != "" {
		fmt.Printf("[Service] Initializing WeChat client with CorpID: %s\n", wechatCfg.CorpID)
		wechatApp = workwx.New(wechatCfg.CorpID).WithApp(wechatCfg.AppSecret, wechatCfg.AppAgentID)
	} else {
		fmt.Printf("[Service] WeChat client not initialized: wechatCfg=%v, CorpID=%s\n", wechatCfg != nil, func() string {
			if wechatCfg != nil {
				return wechatCfg.CorpID
			}
			return ""
		}())
	}

	return &Service{DB: db, Wechat: wechatApp}, nil
}
