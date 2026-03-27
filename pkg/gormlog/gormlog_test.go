package gormlog

import (
	"testing"
	"time"

	gormlogger "gorm.io/gorm/logger"
)

func TestDefaultSlowThreshold(t *testing.T) {
	expected := 200 * time.Millisecond
	if DefaultSlowThreshold != expected {
		t.Errorf("DefaultSlowThreshold = %v, want %v", DefaultSlowThreshold, expected)
	}
}

func TestNew(t *testing.T) {
	tests := []struct {
		name     string
		slow     time.Duration
		wantSlow time.Duration
	}{
		{"zero uses default", 0, DefaultSlowThreshold},
		{"negative uses default", -100 * time.Millisecond, DefaultSlowThreshold},
		{"custom value", 500 * time.Millisecond, 500 * time.Millisecond},
		{"1 second", time.Second, time.Second},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := New(tt.slow)
			if logger == nil {
				t.Fatal("New() returned nil")
			}
			if logger.slowThreshold != tt.wantSlow {
				t.Errorf("slowThreshold = %v, want %v", logger.slowThreshold, tt.wantSlow)
			}
		})
	}
}

func TestTruncateSQL(t *testing.T) {
	tests := []struct {
		name   string
		sql    string
		maxLen int
		want   string
	}{
		{"empty", "", 10, ""},
		{"short", "SELECT 1", 10, "SELECT 1"},
		{"exact length", "12345", 5, "12345"},
		{"needs truncation", "SELECT * FROM users WHERE id = 1", 10, "SELECT * F..."},
		{"long query", "SELECT * FROM users WHERE id = 1 AND status = 'active' ORDER BY created_at DESC", 20, "SELECT * FROM users ..."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := truncateSQL(tt.sql, tt.maxLen); got != tt.want {
				t.Errorf("truncateSQL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestLogger_LogMode(t *testing.T) {
	logger := New(200 * time.Millisecond)

	tests := []struct {
		name string
		lvl  gormlogger.LogLevel
	}{
		{"silent", gormlogger.Silent},
		{"error", gormlogger.Error},
		{"warn", gormlogger.Warn},
		{"info", gormlogger.Info},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newLogger := logger.LogMode(tt.lvl)
			if newLogger == nil {
				t.Error("LogMode() returned nil")
			}
		})
	}
}
