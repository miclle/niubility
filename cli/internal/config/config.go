// Package config provides CLI configuration management
package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// Config represents the CLI configuration
type Config struct {
	// Server is the Niubility server address (e.g., http://127.0.0.1:9000)
	Server string `mapstructure:"server"`

	// Output format: table or json
	Output string `mapstructure:"output"`

	// Editor for content edit command
	Editor string `mapstructure:"editor"`

	// DefaultStatus for new content: draft or published
	DefaultStatus string `mapstructure:"default_status"`

	// Timeout for HTTP requests
	Timeout string `mapstructure:"timeout"`

	// CookieJar path for session persistence
	CookieJar string `mapstructure:"cookie_jar"`
}

// Default configuration values
const (
	DefaultServer       = ""
	DefaultOutput       = "table"
	DefaultEditor       = "vim"
	DefaultStatus       = "draft"
	DefaultTimeout      = "30s"
	DefaultCookieJar    = "~/.config/niubility/cookies.json"
	DefaultConfigDir    = "~/.config/niubility"
	DefaultConfigFile   = "config.yaml"
)

// Errors
var (
	ErrConfigNotFound = errors.New("configuration file not found")
	ErrConfigInvalid  = errors.New("invalid configuration")
)

// Load loads configuration from file and environment variables
func Load() (*Config, error) {
	return LoadFrom("")
}

// LoadFrom loads configuration from a specific file path
func LoadFrom(configPath string) (*Config, error) {
	v := viper.New()

	// Set default values
	setDefaults(v)

	// Bind environment variables
	v.SetEnvPrefix("NIUBILITY")
	v.AutomaticEnv()

	// Determine config file path
	if configPath == "" {
		configDir := expandHome(DefaultConfigDir)
		configPath = filepath.Join(configDir, DefaultConfigFile)
	} else {
		configPath = expandHome(configPath)
	}

	v.SetConfigFile(configPath)

	// Try to read config file, ignore if not exists
	if err := v.ReadInConfig(); err != nil {
		var configFileNotFoundError viper.ConfigFileNotFoundError
		if !errors.As(err, &configFileNotFoundError) && !os.IsNotExist(err) {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
		// Config file doesn't exist, use defaults
	}

	// Unmarshal config
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	// Validate and normalize config
	if err := validateConfig(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	v.SetDefault("server", DefaultServer)
	v.SetDefault("output", DefaultOutput)
	v.SetDefault("editor", DefaultEditor)
	v.SetDefault("default_status", DefaultStatus)
	v.SetDefault("timeout", DefaultTimeout)
	v.SetDefault("cookie_jar", DefaultCookieJar)
}

// validateConfig validates and normalizes configuration
func validateConfig(cfg *Config) error {
	// Validate output format
	if cfg.Output != "table" && cfg.Output != "json" {
		return fmt.Errorf("%w: output must be 'table' or 'json', got '%s'", ErrConfigInvalid, cfg.Output)
	}

	// Validate default status
	if cfg.DefaultStatus != "draft" && cfg.DefaultStatus != "published" {
		return fmt.Errorf("%w: default_status must be 'draft' or 'published', got '%s'", ErrConfigInvalid, cfg.DefaultStatus)
	}

	// Validate timeout
	if _, err := time.ParseDuration(cfg.Timeout); err != nil {
		return fmt.Errorf("%w: invalid timeout format '%s': %v", ErrConfigInvalid, cfg.Timeout, err)
	}

	// Expand home directory in paths
	cfg.CookieJar = expandHome(cfg.CookieJar)

	return nil
}

// GetConfigDir returns the configuration directory path
func GetConfigDir() string {
	return expandHome(DefaultConfigDir)
}

// EnsureConfigDir ensures the configuration directory exists
func EnsureConfigDir() error {
	configDir := GetConfigDir()
	return os.MkdirAll(configDir, 0755)
}

// Save saves the current configuration to file
func Save(cfg *Config) error {
	return SaveTo(cfg, "")
}

// SaveTo saves the current configuration to a specific file path.
func SaveTo(cfg *Config, configPath string) error {
	if configPath == "" {
		configDir := GetConfigDir()
		configPath = filepath.Join(configDir, DefaultConfigFile)
	} else {
		configPath = expandHome(configPath)
	}

	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Create a map for YAML output
	data := map[string]interface{}{
		"server": cfg.Server,
		"output": cfg.Output,
		"editor": cfg.Editor,
		"default_status": cfg.DefaultStatus,
		"timeout": cfg.Timeout,
		"cookie_jar": cfg.CookieJar,
	}

	// Marshal to YAML
	yamlData, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(configPath, yamlData, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// expandHome expands ~ to the user's home directory
func expandHome(path string) string {
	if len(path) >= 2 && path[:2] == "~/" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(homeDir, path[2:])
	}
	return path
}
