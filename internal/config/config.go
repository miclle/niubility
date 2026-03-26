// Package config provides application configuration loading and structures.
package config

import (
	"bytes"
	"fmt"
	"os"

	"github.com/spf13/viper"

	"github.com/miclle/niubility/pkg/textencrypt"
	"github.com/miclle/niubility/pkg/textencrypt/sec"
)

// Config represents the application configuration.
type Config struct {
	Addr   string     `mapstructure:"addr"`   // listen address, e.g. "0.0.0.0:9000"
	Driver string     `mapstructure:"driver"` // database driver: "postgres" (default) or "mysql"
	DSN    sec.Secret `mapstructure:"dsn"`    // database connection string
}

// Load reads configuration from the given file path.
func Load(path string) (*Config, error) {
	cfgFile, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config file: %w", err)
	}

	// Auto-decrypt the config file content if it contains encrypted values
	decryptedContent, err := textencrypt.AutoDecrypt(string(cfgFile))
	if err != nil {
		return nil, fmt.Errorf("decrypt config file: %w", err)
	}

	v := viper.New()
	v.SetConfigType("yaml")
	if err := v.ReadConfig(bytes.NewReader([]byte(decryptedContent))); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	if cfg.Addr == "" {
		return nil, fmt.Errorf("addr is required")
	}
	if cfg.DSN.Value() == "" {
		return nil, fmt.Errorf("dsn is required")
	}
	if cfg.Driver == "" {
		cfg.Driver = "postgres"
	}
	if cfg.Driver != "postgres" && cfg.Driver != "mysql" {
		return nil, fmt.Errorf("unsupported driver: %s (supported: postgres, mysql)", cfg.Driver)
	}

	return &cfg, nil
}
