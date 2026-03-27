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
cookie_jar: "~/custom/cookies.json"
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
		CookieJar:     "~/.config/niubility/cookies.json",
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
