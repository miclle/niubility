package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadFrom_CustomPath(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "custom.yaml")

	content := []byte(`server: "http://example.com:9000"
output: "json"
editor: "nano"
default_status: "published"
timeout: "45s"
token: "jwt-token"
`)

	if err := os.WriteFile(configPath, content, 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	cfg, err := LoadFrom(configPath)
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if cfg.Server != "http://example.com:9000" {
		t.Fatalf("Server = %q, want %q", cfg.Server, "http://example.com:9000")
	}
	if cfg.Output != "json" {
		t.Fatalf("Output = %q, want %q", cfg.Output, "json")
	}
	if cfg.DefaultStatus != "published" {
		t.Fatalf("DefaultStatus = %q, want %q", cfg.DefaultStatus, "published")
	}
}

func TestSaveTo_CustomPath(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "nested", "custom.yaml")

	cfg := &Config{
		Server:        "http://localhost:9000",
		Output:        "json",
		Editor:        "vim",
		DefaultStatus: "draft",
		Timeout:       "30s",
		Token:         "jwt-token",
	}

	if err := SaveTo(cfg, configPath); err != nil {
		t.Fatalf("SaveTo() error = %v", err)
	}

	if _, err := os.Stat(configPath); err != nil {
		t.Fatalf("expected config file at %s: %v", configPath, err)
	}

	loaded, err := LoadFrom(configPath)
	if err != nil {
		t.Fatalf("LoadFrom() after SaveTo() error = %v", err)
	}

	if loaded.Server != cfg.Server {
		t.Fatalf("Server = %q, want %q", loaded.Server, cfg.Server)
	}
	if loaded.Output != cfg.Output {
		t.Fatalf("Output = %q, want %q", loaded.Output, cfg.Output)
	}
}

func TestLoadFrom_NormalizesServerURL(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "config.yaml")

	content := []byte(`server: "http://example.com:9000/"
output: "table"
editor: "vim"
default_status: "draft"
timeout: "30s"
token: "jwt-token"
`)

	if err := os.WriteFile(configPath, content, 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	cfg, err := LoadFrom(configPath)
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if cfg.Server != "http://example.com:9000" {
		t.Fatalf("Server = %q, want %q", cfg.Server, "http://example.com:9000")
	}
}

func TestResolveConfigPath_Profile(t *testing.T) {
	got := ResolveConfigPath("prod", "")
	want := filepath.Join(expandHome(DefaultProfilesDir), "prod.yaml")
	if got != want {
		t.Fatalf("ResolveConfigPath() = %q, want %q", got, want)
	}
}

func TestValidateProfile(t *testing.T) {
	valid := []string{"", "default", "dev", "prod_1", "qa-east"}
	for _, profile := range valid {
		if err := ValidateProfile(profile); err != nil {
			t.Fatalf("ValidateProfile(%q) error = %v", profile, err)
		}
	}

	invalid := []string{"../prod", "qa east", "prod/test", "prod.toml"}
	for _, profile := range invalid {
		if err := ValidateProfile(profile); err == nil {
			t.Fatalf("ValidateProfile(%q) expected error, got nil", profile)
		}
	}
}
