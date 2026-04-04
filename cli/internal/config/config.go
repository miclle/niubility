// Package config provides CLI configuration management
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
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

	// Token is the persisted CLI bearer token.
	Token string `mapstructure:"token"`
}

// Default configuration values
const (
	DefaultServer      = ""
	DefaultOutput      = "table"
	DefaultEditor      = "vim"
	DefaultStatus      = "draft"
	DefaultTimeout     = "30s"
	DefaultConfigDir   = "~/.config/niubility"
	DefaultConfigFile  = "config.yaml"
	DefaultProfilesDir = "~/.config/niubility/profiles"
)

// Errors
var (
	ErrConfigNotFound = errors.New("configuration file not found")
	ErrConfigInvalid  = errors.New("invalid configuration")
)

// Load loads configuration from file and environment variables
func Load() (*Config, error) {
	return LoadProfile("", "")
}

// LoadFrom loads configuration from a specific file path
func LoadFrom(configPath string) (*Config, error) {
	return LoadProfile("", configPath)
}

// LoadProfile loads configuration for a profile or a specific config path.
func LoadProfile(profile, configPath string) (*Config, error) {
	v := viper.New()

	// Set default values
	setDefaults(v, profile)

	// Bind environment variables
	v.SetEnvPrefix("NIUBILITY")
	v.AutomaticEnv()

	// Determine config file path
	configPath = ResolveConfigPath(profile, configPath)

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
func setDefaults(v *viper.Viper, profile string) {
	v.SetDefault("server", DefaultServer)
	v.SetDefault("output", DefaultOutput)
	v.SetDefault("editor", DefaultEditor)
	v.SetDefault("default_status", DefaultStatus)
	v.SetDefault("timeout", DefaultTimeout)
	v.SetDefault("token", "")
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
	cfg.Server = normalizeServerURL(cfg.Server)

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
	return SaveProfile("", cfg, "")
}

// SaveTo saves the current configuration to a specific file path.
func SaveTo(cfg *Config, configPath string) error {
	return SaveProfile("", cfg, configPath)
}

// SaveProfile saves the current configuration for a profile or specific config path.
func SaveProfile(profile string, cfg *Config, configPath string) error {
	configPath = ResolveConfigPath(profile, configPath)

	if err := os.MkdirAll(filepath.Dir(configPath), 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Create a map for YAML output
	data := map[string]interface{}{
		"server":         cfg.Server,
		"output":         cfg.Output,
		"editor":         cfg.Editor,
		"default_status": cfg.DefaultStatus,
		"timeout":        cfg.Timeout,
		"token":          cfg.Token,
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

func normalizeServerURL(raw string) string {
	if raw == "" {
		return raw
	}

	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}

	if u.Path == "/" {
		u.Path = ""
	}

	return u.String()
}

// ResolveConfigPath resolves the config path for a profile or explicit path.
func ResolveConfigPath(profile, configPath string) string {
	if configPath != "" {
		return expandHome(configPath)
	}

	if isDefaultProfile(profile) {
		return filepath.Join(GetConfigDir(), DefaultConfigFile)
	}

	return filepath.Join(expandHome(DefaultProfilesDir), profile+".yaml")
}

// ValidateProfile validates a profile name.
func ValidateProfile(profile string) error {
	if profile == "" {
		return nil
	}

	validProfile := regexp.MustCompile(`^[A-Za-z0-9_-]+$`)
	if !validProfile.MatchString(profile) {
		return fmt.Errorf("%w: invalid profile name '%s'", ErrConfigInvalid, profile)
	}

	return nil
}

func isDefaultProfile(profile string) bool {
	return profile == "" || profile == "default"
}
