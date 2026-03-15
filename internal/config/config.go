// Package config provides application configuration loading and structures.
package config

import (
	"fmt"

	"github.com/spf13/viper"

	"github.com/miclle/niubility/pkg/sso"
	"github.com/miclle/niubility/pkg/textencrypt/sec"
)

// Config represents the application configuration.
type Config struct {
	Server   Server       `mapstructure:"server"`
	Database Database     `mapstructure:"database"`
	SSO      sso.Config   `mapstructure:"sso"`
	Wechat   WechatConfig `mapstructure:"wechat"`
}

// WechatConfig holds enterprise WeChat configuration.
type WechatConfig struct {
	CorpID     string `mapstructure:"corp_id"`     // Enterprise ID
	AppAgentID int64  `mapstructure:"app_agentid"` // Application agent ID
	AppSecret  string `mapstructure:"app_secret"`  // Application secret
}

// Server holds HTTP server settings.
type Server struct {
	Address       string    `mapstructure:"address"`       // listen address, e.g. "0.0.0.0:9000"
	Secret        string    `mapstructure:"secret"`        // JWT signing secret
	CookieSecure  bool      `mapstructure:"cookieSecure"`  // set Secure flag on cookies (HTTPS)
	EncryptionKey sec.Secret `mapstructure:"encryptionKey"` // 32-byte hex key for AES-256-GCM encryption
}

// Database holds database connection settings.
type Database struct {
	DSN string `mapstructure:"dsn"` // PostgreSQL connection string
}

// Load reads configuration from the given file path.
func Load(path string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(path)

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return &cfg, nil
}
