package service

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_GetBackupConfig_Defaults(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	cfg, err := s.GetBackupConfig(ctx)
	if err != nil {
		t.Fatalf("GetBackupConfig() error = %v", err)
	}
	if cfg.S3Prefix != "backups/database" {
		t.Errorf("GetBackupConfig().S3Prefix = %q, want %q", cfg.S3Prefix, "backups/database")
	}
	if cfg.DownloadURLTTLSeconds != 900 {
		t.Errorf("GetBackupConfig().DownloadURLTTLSeconds = %d, want 900", cfg.DownloadURLTTLSeconds)
	}
}

func TestBuildDatabaseBackupObjectKey(t *testing.T) {
	now := time.Date(2026, 4, 10, 9, 0, 0, 0, time.UTC)
	got := buildDatabaseBackupObjectKey("backups/database", now, "test.sql.gz")
	want := "backups/database/2026/04/10/test.sql.gz"
	if got != want {
		t.Errorf("buildDatabaseBackupObjectKey() = %q, want %q", got, want)
	}
}

func TestParseDatabaseConnectionInfo(t *testing.T) {
	t.Run("postgres url", func(t *testing.T) {
		info, err := parseDatabaseConnectionInfo("postgres", "postgres://tester:secret@localhost:5433/niubility?sslmode=disable")
		if err != nil {
			t.Fatalf("parseDatabaseConnectionInfo() error = %v", err)
		}
		if info.Host != "localhost" || info.Port != "5433" || info.User != "tester" || info.Password != "secret" || info.Database != "niubility" {
			t.Fatalf("unexpected postgres info: %+v", info)
		}
	})

	t.Run("mysql dsn", func(t *testing.T) {
		info, err := parseDatabaseConnectionInfo("mysql", "tester:secret@tcp(db.example.com:3307)/niubility?parseTime=true")
		if err != nil {
			t.Fatalf("parseDatabaseConnectionInfo() error = %v", err)
		}
		if info.Host != "db.example.com" || info.Port != "3307" || info.User != "tester" || info.Password != "secret" || info.Database != "niubility" {
			t.Fatalf("unexpected mysql info: %+v", info)
		}
	})
}

func TestGzipFile(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "backup.sql")
	dst := filepath.Join(dir, "backup.sql.gz")
	if err := os.WriteFile(src, []byte("select 1;\n"), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	size, checksum, err := gzipFile(src, dst)
	if err != nil {
		t.Fatalf("gzipFile() error = %v", err)
	}
	if size <= 0 {
		t.Errorf("gzipFile() size = %d, want > 0", size)
	}
	if checksum == "" {
		t.Error("gzipFile() checksum is empty")
	}
}

func TestService_StartDatabaseBackup_Success(t *testing.T) {
	s := setupTestService(t)
	s.dialect = "postgres"
	s.dsn = "postgres://tester:secret@localhost:5432/niubility?sslmode=disable"
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingS3Endpoint:                          "https://s3.example.com",
		entity.SettingS3Region:                            "us-east-1",
		entity.SettingS3Bucket:                            "niubility",
		entity.SettingS3AccessKey:                         "ak",
		entity.SettingS3SecretKey:                         "sk",
		entity.SettingBackupDatabaseS3Prefix:              "backups/database",
		entity.SettingBackupDatabaseDownloadURLTTLSeconds: "900",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	s.commandRunner = func(ctx context.Context, name string, args []string, env []string, stdout, stderr io.Writer) error {
		_, _ = stdout.Write([]byte("select 1;\n"))
		return nil
	}

	var uploadedPath string
	var uploadedKey string
	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error {
		uploadedPath = localPath
		uploadedKey = objectKey
		if _, err := os.Stat(localPath); err != nil {
			return fmt.Errorf("stat uploaded file: %w", err)
		}
		return nil
	}

	operator := &entity.User{ID: "admin-1", Username: "admin", Name: "管理员"}
	record, err := s.StartDatabaseBackup(ctx, operator)
	if err != nil {
		t.Fatalf("StartDatabaseBackup() error = %v", err)
	}

	stored, err := s.getBackupRecordByID(ctx, record.ID)
	if err != nil {
		t.Fatalf("getBackupRecordByID() error = %v", err)
	}
	if stored.Status != entity.BackupStatusSuccess {
		t.Fatalf("backup status = %q, want %q", stored.Status, entity.BackupStatusSuccess)
	}
	if uploadedKey == "" || uploadedPath == "" {
		t.Fatal("backup uploader was not called")
	}
	if !strings.HasSuffix(stored.FileName, ".sql.gz") {
		t.Errorf("backup file name = %q, want suffix .sql.gz", stored.FileName)
	}
}

func TestService_StartDatabaseBackup_ConflictWhenRunning(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()
	existing := &entity.BackupRecord{
		ID:        entity.ID(),
		Type:      entity.BackupTypeDatabase,
		Status:    entity.BackupStatusRunning,
		StartedAt: time.Now(),
	}
	if err := s.db.WithContext(ctx).Create(existing).Error; err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	_, err := s.StartDatabaseBackup(ctx, &entity.User{ID: "admin-1", Username: "admin"})
	if err == nil {
		t.Fatal("StartDatabaseBackup() error = nil, want conflict")
	}
	if err != ErrDatabaseBackupRunning {
		t.Fatalf("StartDatabaseBackup() error = %v, want %v", err, ErrDatabaseBackupRunning)
	}
}
