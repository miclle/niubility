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

func TestService_LoadSettingsBatch(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Insert multiple settings
	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		"batch_a": "value_a",
		"batch_b": "value_b",
		"batch_c": "value_c",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	// Batch load should return all keys in one query
	m := s.loadSettings(ctx, "batch_a", "batch_b", "batch_c", "nonexistent")
	if m["batch_a"] != "value_a" {
		t.Errorf("loadSettings[batch_a] = %q, want %q", m["batch_a"], "value_a")
	}
	if m["batch_b"] != "value_b" {
		t.Errorf("loadSettings[batch_b] = %q, want %q", m["batch_b"], "value_b")
	}
	if m["batch_c"] != "value_c" {
		t.Errorf("loadSettings[batch_c] = %q, want %q", m["batch_c"], "value_c")
	}
	if m["nonexistent"] != "" {
		t.Errorf("loadSettings[nonexistent] = %q, want empty", m["nonexistent"])
	}

	// Empty keys should return empty map
	empty := s.loadSettings(ctx)
	if len(empty) != 0 {
		t.Errorf("loadSettings() returned %d items, want 0", len(empty))
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

func TestService_GetDeliveryConfig(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingDeliveryProvider:       "qiniu",
		entity.SettingDeliveryDomain:         "https://img.example.com",
		entity.SettingDeliveryPrivateEnabled: "true",
		entity.SettingDeliveryURLTTLSeconds:  "7200",
		entity.SettingDeliveryStyleMode:      "path_suffix",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	cfg, err := s.GetDeliveryConfig(ctx)
	if err != nil {
		t.Fatalf("GetDeliveryConfig() error = %v", err)
	}

	if cfg.Provider != "qiniu" {
		t.Fatalf("Provider = %q, want %q", cfg.Provider, "qiniu")
	}
	if cfg.Domain != "https://img.example.com" {
		t.Fatalf("Domain = %q, want %q", cfg.Domain, "https://img.example.com")
	}
	if !cfg.PrivateEnabled {
		t.Fatalf("PrivateEnabled = false, want true")
	}
	if cfg.URLTTLSeconds != 7200 {
		t.Fatalf("URLTTLSeconds = %d, want %d", cfg.URLTTLSeconds, 7200)
	}
	if cfg.StyleMode != "path_suffix" {
		t.Fatalf("StyleMode = %q, want %q", cfg.StyleMode, "path_suffix")
	}
}

func TestService_GetSiteConfig(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingSiteTitle:                         "Acme Learning",
		entity.SettingSiteDescription:                   "内部学习平台",
		entity.SettingSiteKeywords:                      "学习,知识库",
		entity.SettingSiteVersion:                       "v2.3.1",
		entity.SettingSiteFaviconURL:                    "favicon.png",
		entity.SettingSiteLogoURL:                       "logo.svg",
		entity.SettingSiteCopyright:                     "Acme",
		entity.SettingSiteForceHTTPS:                    "true",
		entity.SettingSiteFooter:                        "<span>footer</span>",
		entity.SettingSiteVideoDefaultCoverURL:          "video-default.png",
		entity.SettingSiteVideoSpeakerDefaultAvatarURL:  "speaker-default.png",
		entity.SettingDeliveryVideoCardImageStyle:       "imageView2/1/w/640/h/360",
		entity.SettingDeliveryGalleryCardImageStyle:     "imageView2/1/w/480/h/270",
		entity.SettingDeliveryGalleryOriginalImageStyle: "imageView2/2/w/1920",
		entity.SettingDeliveryGalleryDetailImageStyle:   "imageView2/2/w/720",
		entity.SettingDeliveryAvatarImageStyle:          "imageView2/1/w/96/h/96",
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
	if cfg.VideoCardImageStyle != "imageView2/1/w/640/h/360" {
		t.Errorf("VideoCardImageStyle = %q, want %q", cfg.VideoCardImageStyle, "imageView2/1/w/640/h/360")
	}
	if cfg.GalleryCardImageStyle != "imageView2/1/w/480/h/270" {
		t.Errorf("GalleryCardImageStyle = %q, want %q", cfg.GalleryCardImageStyle, "imageView2/1/w/480/h/270")
	}
	if cfg.GalleryOriginalImageStyle != "imageView2/2/w/1920" {
		t.Errorf("GalleryOriginalImageStyle = %q, want %q", cfg.GalleryOriginalImageStyle, "imageView2/2/w/1920")
	}
	if cfg.GalleryDetailImageStyle != "imageView2/2/w/720" {
		t.Errorf("GalleryDetailImageStyle = %q, want %q", cfg.GalleryDetailImageStyle, "imageView2/2/w/720")
	}
	if cfg.AvatarImageStyle != "imageView2/1/w/96/h/96" {
		t.Errorf("AvatarImageStyle = %q, want %q", cfg.AvatarImageStyle, "imageView2/1/w/96/h/96")
	}
}

func TestService_GetSiteConfig_FallsBackToLegacyImageStyleKeys(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingSiteGalleryCardImageStyle:   "legacy-card-style",
		entity.SettingSiteGalleryDetailImageStyle: "legacy-detail-style",
		entity.SettingSiteAvatarImageStyle:        "legacy-avatar-style",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	cfg, err := s.GetSiteConfig(ctx)
	if err != nil {
		t.Fatalf("GetSiteConfig() error = %v", err)
	}

	if cfg.GalleryCardImageStyle != "legacy-card-style" {
		t.Errorf("GalleryCardImageStyle = %q, want %q", cfg.GalleryCardImageStyle, "legacy-card-style")
	}
	if cfg.GalleryDetailImageStyle != "legacy-detail-style" {
		t.Errorf("GalleryDetailImageStyle = %q, want %q", cfg.GalleryDetailImageStyle, "legacy-detail-style")
	}
	if cfg.AvatarImageStyle != "legacy-avatar-style" {
		t.Errorf("AvatarImageStyle = %q, want %q", cfg.AvatarImageStyle, "legacy-avatar-style")
	}
}
