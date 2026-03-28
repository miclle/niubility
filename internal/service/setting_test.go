package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_GetSetting(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Test getting non-existent setting
	val, err := s.GetSetting(ctx, "nonexistent")
	if err != nil {
		t.Errorf("GetSetting() error = %v", err)
	}
	if val != "" {
		t.Errorf("GetSetting() = %q, want empty string", val)
	}

	// Test setting and getting a value
	if err := s.SetSetting(ctx, "test_key", "test_value"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}

	val, err = s.GetSetting(ctx, "test_key")
	if err != nil {
		t.Fatalf("GetSetting() error = %v", err)
	}
	if val != "test_value" {
		t.Errorf("GetSetting() = %q, want %q", val, "test_value")
	}
}

func TestService_SetSetting(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create new setting
	if err := s.SetSetting(ctx, "new_key", "new_value"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}

	// Update existing setting
	if err := s.SetSetting(ctx, "new_key", "updated_value"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}

	val, err := s.GetSetting(ctx, "new_key")
	if err != nil {
		t.Fatalf("GetSetting() error = %v", err)
	}
	if val != "updated_value" {
		t.Errorf("GetSetting() = %q, want %q", val, "updated_value")
	}
}

func TestService_ListSettings(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Add some settings
	if err := s.SetSetting(ctx, "key1", "value1"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}
	if err := s.SetSetting(ctx, "key2", "value2"); err != nil {
		t.Fatalf("SetSetting() error = %v", err)
	}

	settings, err := s.ListSettings(ctx)
	if err != nil {
		t.Fatalf("ListSettings() error = %v", err)
	}
	if len(settings) < 2 {
		t.Errorf("ListSettings() returned %d settings, want at least 2", len(settings))
	}
}

func TestService_UpdateSettingsBatch(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	settings := map[string]string{
		"batch_key1": "batch_value1",
		"batch_key2": "batch_value2",
		"batch_key3": "batch_value3",
	}

	if err := s.UpdateSettingsBatch(ctx, settings); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	for key, want := range settings {
		got, err := s.GetSetting(ctx, key)
		if err != nil {
			t.Fatalf("GetSetting(%s) error = %v", key, err)
		}
		if got != want {
			t.Errorf("GetSetting(%s) = %q, want %q", key, got, want)
		}
	}
}

func TestSensitiveKeys(t *testing.T) {
	// Test that sensitiveKeys map contains expected keys
	expectedKeys := []string{
		entity.SettingWechatAppSecret,
		entity.SettingSSOOIDCClientSecret,
		entity.SettingS3SecretKey,
	}

	for _, key := range expectedKeys {
		if !sensitiveKeys[key] {
			t.Errorf("sensitiveKeys[%q] = false, want true", key)
		}
	}
}

func TestService_GetSiteConfig(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingSiteTitle:                        "Acme Learning",
		entity.SettingSiteDescription:                  "内部学习平台",
		entity.SettingSiteKeywords:                     "学习,知识库",
		entity.SettingSiteVersion:                      "v2.3.1",
		entity.SettingSiteFaviconURL:                   "favicon.png",
		entity.SettingSiteLogoURL:                      "logo.svg",
		entity.SettingSiteCopyright:                    "Acme",
		entity.SettingSiteForceHTTPS:                   "true",
		entity.SettingSiteFooter:                       "<span>footer</span>",
		entity.SettingSiteVideoDefaultCoverURL:         "video-default.png",
		entity.SettingSiteVideoSpeakerDefaultAvatarURL: "speaker-default.png",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	cfg, err := s.GetSiteConfig(ctx)
	if err != nil {
		t.Fatalf("GetSiteConfig() error = %v", err)
	}

	if cfg.Title != "Acme Learning" {
		t.Errorf("Title = %q, want %q", cfg.Title, "Acme Learning")
	}
	if cfg.Version != "v2.3.1" {
		t.Errorf("Version = %q, want %q", cfg.Version, "v2.3.1")
	}
	if !cfg.ForceHTTPS {
		t.Errorf("ForceHTTPS = false, want true")
	}
	if cfg.VideoDefaultCoverURL != "video-default.png" {
		t.Errorf("VideoDefaultCoverURL = %q, want %q", cfg.VideoDefaultCoverURL, "video-default.png")
	}
	if cfg.VideoSpeakerDefaultAvatarURL != "speaker-default.png" {
		t.Errorf("VideoSpeakerDefaultAvatarURL = %q, want %q", cfg.VideoSpeakerDefaultAvatarURL, "speaker-default.png")
	}
}
