// Package config provides application configuration loading and structures.
package config

import (
	"fmt"

	"github.com/spf13/viper"
)

// Config represents the application configuration.
type Config struct {
	Server   Server   `mapstructure:"server"`
	Database Database `mapstructure:"database"`
}

// Server holds HTTP server settings.
type Server struct {
	Address string `mapstructure:"address"` // listen address, e.g. "0.0.0.0:9000"
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

	if cfg.Server.Address == "" {
		return nil, fmt.Errorf("server.address is required")
	}
	if cfg.Database.DSN == "" {
		return nil, fmt.Errorf("database.dsn is required")
	}

	return &cfg, nil
}
