package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB creates an in-memory SQLite database for testing.
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Auto migrate all entities
	if err := db.AutoMigrate(
		&entity.User{},
		&entity.Content{},
		&entity.Attachment{},
		&entity.Setting{},
		&entity.Department{},
		&entity.Comment{},
		&entity.Like{},
		&entity.Category{},
		&entity.Follow{},
		&entity.Favorite{},
	); err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// setupTestService creates a Service with an in-memory database for testing.
func setupTestService(t *testing.T) *Service {
	t.Helper()
	db := setupTestDB(t)
	return &Service{
		db:      db,
		dialect: "sqlite",
	}
}

func TestGenerateHexKey(t *testing.T) {
	tests := []struct {
		name string
		n    int
	}{
		{"16 bytes", 16},
		{"32 bytes", 32},
		{"64 bytes", 64},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key1, err := generateHexKey(tt.n)
			if err != nil {
				t.Fatalf("generateHexKey() error = %v", err)
			}
			// Hex encoding doubles the length
			if len(key1) != tt.n*2 {
				t.Errorf("generateHexKey() length = %d, want %d", len(key1), tt.n*2)
			}

			// Generate another key and verify they're different
			key2, err := generateHexKey(tt.n)
			if err != nil {
				t.Fatalf("generateHexKey() error = %v", err)
			}
			if key1 == key2 {
				t.Error("generateHexKey() returned duplicate keys")
			}
		})
	}
}

func TestService_IsMySQL(t *testing.T) {
	tests := []struct {
		name    string
		dialect string
		want    bool
	}{
		{"postgres dialect", "postgres", false},
		{"mysql dialect", "mysql", true},
		{"sqlite dialect", "sqlite", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := &Service{dialect: tt.dialect}
			if got := s.isMySQL(); got != tt.want {
				t.Errorf("isMySQL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestService_GetJWTSecret(t *testing.T) {
	s := &Service{jwtSecret: "test-secret"}
	if got := s.GetJWTSecret(); got != "test-secret" {
		t.Errorf("GetJWTSecret() = %q, want %q", got, "test-secret")
	}
}

func TestService_EnsureSetting(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// First call should generate a new value
	val1, err := s.ensureSetting(ctx, "test_key", func() (string, error) {
		return "generated_value", nil
	})
	if err != nil {
		t.Fatalf("ensureSetting() error = %v", err)
	}
	if val1 != "generated_value" {
		t.Errorf("ensureSetting() = %q, want %q", val1, "generated_value")
	}

	// Second call should return the existing value
	val2, err := s.ensureSetting(ctx, "test_key", func() (string, error) {
		return "different_value", nil
	})
	if err != nil {
		t.Fatalf("ensureSetting() error = %v", err)
	}
	if val2 != "generated_value" {
		t.Errorf("ensureSetting() = %q, want %q", val2, "generated_value")
	}
}
