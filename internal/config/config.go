// Package config provides application configuration loading and structures.
package config

import (
	"fmt"

	"github.com/spf13/viper"

	"github.com/miclle/niubility/pkg/sso"
)

// Config represents the application configuration.
type Config struct {
	Server   Server     `yaml:"server"`
	Database Database   `yaml:"database"`
	SSO      sso.Config `yaml:"sso"`
}

// Server holds HTTP server settings.
type Server struct {
	Address      string `yaml:"address"`      // listen address, e.g. "0.0.0.0:9000"
	Secret       string `yaml:"secret"`       // JWT signing secret
	CookieSecure bool   `yaml:"cookieSecure"` // set Secure flag on cookies (HTTPS)
}

// Database holds database connection settings.
type Database struct {
	DSN string `yaml:"dsn"` // PostgreSQL connection string
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
