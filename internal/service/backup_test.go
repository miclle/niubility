package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
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

	t.Run("postgres keyword dsn with spaces", func(t *testing.T) {
		info, err := parseDatabaseConnectionInfo("postgres", "host=localhost port=5433 user=tester password='sec ret' dbname='niu bility' sslmode=disable")
		if err != nil {
			t.Fatalf("parseDatabaseConnectionInfo() error = %v", err)
		}
		if info.Host != "localhost" || info.Port != "5433" || info.User != "tester" || info.Password != "sec ret" || info.Database != "niu bility" || info.SSLMode != "disable" {
			t.Fatalf("unexpected postgres keyword info: %+v", info)
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
	s.lookPath = func(file string) (string, error) {
		return "/usr/bin/" + file, nil
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
	lockKey := entity.BackupTypeDatabase
	existing := &entity.BackupRecord{
		ID:        entity.ID(),
		Type:      entity.BackupTypeDatabase,
		Status:    entity.BackupStatusRunning,
		LockKey:   &lockKey,
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

func TestService_CreateRunningBackupRecord_ConflictOnDuplicateLock(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	lockKey := entity.BackupTypeDatabase
	existing := &entity.BackupRecord{
		ID:              entity.ID(),
		Type:            entity.BackupTypeDatabase,
		Status:          entity.BackupStatusRunning,
		Driver:          "postgres",
		Compressed:      true,
		LockKey:         &lockKey,
		StartedByUserID: "admin-1",
		StartedByName:   "管理员",
		StartedAt:       time.Now(),
	}
	if err := s.db.WithContext(ctx).Create(existing).Error; err != nil {
		t.Fatalf("Create() error = %v", err)
	}

	_, err := s.createRunningBackupRecord(ctx, &entity.User{ID: "admin-2", Username: "admin2", Name: "管理员 2"})
	if err == nil {
		t.Fatal("createRunningBackupRecord() error = nil, want conflict")
	}
	if !errors.Is(err, ErrDatabaseBackupRunning) {
		t.Fatalf("createRunningBackupRecord() error = %v, want %v", err, ErrDatabaseBackupRunning)
	}
}

func TestService_StartDatabaseBackup_FallbackToGoBuiltin(t *testing.T) {
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

	// lookPath returns not found → should fall back to nativeDumper
	s.lookPath = func(file string) (string, error) {
		return "", exec.ErrNotFound
	}

	var nativeDumperCalled bool
	s.nativeDumper = func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
		nativeDumperCalled = true
		_, _ = w.Write([]byte("-- go builtin dump\nSELECT 1;\n"))
		return nil
	}

	var commandRunnerCalled bool
	s.commandRunner = func(ctx context.Context, name string, args []string, env []string, stdout, stderr io.Writer) error {
		commandRunnerCalled = true
		return nil
	}

	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error {
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
		t.Errorf("backup status = %q, want %q; error = %s", stored.Status, entity.BackupStatusSuccess, stored.ErrorMessage)
	}
	if stored.Method != entity.BackupMethodGoBuiltin {
		t.Errorf("backup method = %q, want %q", stored.Method, entity.BackupMethodGoBuiltin)
	}
	if !nativeDumperCalled {
		t.Error("nativeDumper was not called")
	}
	if commandRunnerCalled {
		t.Error("commandRunner should not be called when tool is not found")
	}
}

func TestService_StartDatabaseBackup_PreferNativeTool(t *testing.T) {
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

	s.lookPath = func(file string) (string, error) {
		return "/usr/bin/" + file, nil
	}

	var commandRunnerCalled bool
	s.commandRunner = func(ctx context.Context, name string, args []string, env []string, stdout, stderr io.Writer) error {
		commandRunnerCalled = true
		_, _ = stdout.Write([]byte("select 1;\n"))
		return nil
	}

	var nativeDumperCalled bool
	s.nativeDumper = func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
		nativeDumperCalled = true
		return nil
	}

	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error {
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
		t.Errorf("backup status = %q, want %q; error = %s", stored.Status, entity.BackupStatusSuccess, stored.ErrorMessage)
	}
	if stored.Method != entity.BackupMethodNativeTool {
		t.Errorf("backup method = %q, want %q", stored.Method, entity.BackupMethodNativeTool)
	}
	if !commandRunnerCalled {
		t.Error("commandRunner was not called")
	}
	if nativeDumperCalled {
		t.Error("nativeDumper should not be called when native tool is available")
	}
}

func TestService_StartDatabaseBackup_NativeToolFailureNoFallback(t *testing.T) {
	s := setupTestService(t)
	s.dialect = "postgres"
	s.dsn = "postgres://tester:secret@localhost:5432/niubility?sslmode=disable"
	ctx := context.Background()

	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingS3Endpoint:  "https://s3.example.com",
		entity.SettingS3Region:    "us-east-1",
		entity.SettingS3Bucket:    "niubility",
		entity.SettingS3AccessKey: "ak",
		entity.SettingS3SecretKey: "sk",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	// Tool exists but fails
	s.lookPath = func(file string) (string, error) {
		return "/usr/bin/" + file, nil
	}
	s.commandRunner = func(ctx context.Context, name string, args []string, env []string, stdout, stderr io.Writer) error {
		_, _ = stderr.Write([]byte("connection refused"))
		return fmt.Errorf("exit status 1")
	}

	var nativeDumperCalled bool
	s.nativeDumper = func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
		nativeDumperCalled = true
		return nil
	}

	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error {
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
	if stored.Status != entity.BackupStatusFailed {
		t.Errorf("backup status = %q, want %q", stored.Status, entity.BackupStatusFailed)
	}
	if nativeDumperCalled {
		t.Error("nativeDumper should not be called when native tool exists but fails")
	}
}

func TestService_RecoverStaleLocks_DeadNode(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create a service node that stopped heartbeating (dead)
	deadNodeID := "dead-host:web:0.0.0.0:9000"
	s.db.WithContext(ctx).Create(&entity.ServiceNode{
		ID:              entity.ID(),
		NodeID:          deadNodeID,
		NodeType:        entity.NodeTypeWeb,
		LastHeartbeatAt: time.Now().Add(-5 * time.Minute), // Well beyond 90s timeout
	})

	// Create a stuck running backup owned by the dead node
	lockKey := entity.BackupTypeDatabase
	stuckRecord := &entity.BackupRecord{
		ID:        entity.ID(),
		Type:      entity.BackupTypeDatabase,
		Status:    entity.BackupStatusRunning,
		LockKey:   &lockKey,
		NodeID:    deadNodeID,
		StartedAt: time.Now().Add(-10 * time.Minute),
	}
	s.db.WithContext(ctx).Create(stuckRecord)

	// A new backup should succeed because the stale lock gets recovered
	s.nativeDumper = func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
		_, _ = w.Write([]byte("SELECT 1;\n"))
		return nil
	}
	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error { return nil }
	s.dialect = "postgres"
	s.dsn = "postgres://tester:secret@localhost:5432/niubility?sslmode=disable"
	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingS3Endpoint:  "https://s3.example.com",
		entity.SettingS3Region:    "us-east-1",
		entity.SettingS3Bucket:    "niubility",
		entity.SettingS3AccessKey: "ak",
		entity.SettingS3SecretKey: "sk",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	operator := &entity.User{ID: "admin-1", Username: "admin", Name: "管理员"}
	_, err := s.StartDatabaseBackup(ctx, operator)
	if err != nil {
		t.Fatalf("StartDatabaseBackup() error = %v, want nil (stale lock should be recovered)", err)
	}

	// Verify the old record was force-failed
	var old entity.BackupRecord
	s.db.WithContext(ctx).Where("id = ?", stuckRecord.ID).First(&old)
	if old.Status != entity.BackupStatusFailed {
		t.Errorf("stale record status = %q, want %q", old.Status, entity.BackupStatusFailed)
	}
	if old.LockKey != nil {
		t.Error("stale record lock_key should be nil")
	}
}

func TestService_RecoverStaleLocks_AliveNode(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create a service node that is alive
	aliveNodeID := "alive-host:web:0.0.0.0:9000"
	s.db.WithContext(ctx).Create(&entity.ServiceNode{
		ID:              entity.ID(),
		NodeID:          aliveNodeID,
		NodeType:        entity.NodeTypeWeb,
		LastHeartbeatAt: time.Now(), // Just heartbeated
	})

	// Create a running backup owned by the alive node
	lockKey := entity.BackupTypeDatabase
	runningRecord := &entity.BackupRecord{
		ID:        entity.ID(),
		Type:      entity.BackupTypeDatabase,
		Status:    entity.BackupStatusRunning,
		LockKey:   &lockKey,
		NodeID:    aliveNodeID,
		StartedAt: time.Now().Add(-1 * time.Minute),
	}
	s.db.WithContext(ctx).Create(runningRecord)

	// A new backup should fail with conflict because the running backup's node is alive
	operator := &entity.User{ID: "admin-1", Username: "admin", Name: "管理员"}
	_, err := s.StartDatabaseBackup(ctx, operator)
	if !errors.Is(err, ErrDatabaseBackupRunning) {
		t.Fatalf("StartDatabaseBackup() error = %v, want %v", err, ErrDatabaseBackupRunning)
	}
}

func TestService_RecoverStaleLocks_LegacyRecordTimeout(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create a legacy running record without NodeID, started 31 minutes ago
	lockKey := entity.BackupTypeDatabase
	legacyRecord := &entity.BackupRecord{
		ID:        entity.ID(),
		Type:      entity.BackupTypeDatabase,
		Status:    entity.BackupStatusRunning,
		LockKey:   &lockKey,
		NodeID:    "", // Legacy — no node tracking
		StartedAt: time.Now().Add(-31 * time.Minute),
	}
	s.db.WithContext(ctx).Create(legacyRecord)

	// A new backup should succeed because the legacy lock is timed out
	s.nativeDumper = func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
		_, _ = w.Write([]byte("SELECT 1;\n"))
		return nil
	}
	s.backupUploader = func(ctx context.Context, localPath, objectKey string) error { return nil }
	s.dialect = "postgres"
	s.dsn = "postgres://tester:secret@localhost:5432/niubility?sslmode=disable"
	if err := s.UpdateSettingsBatch(ctx, map[string]string{
		entity.SettingS3Endpoint:  "https://s3.example.com",
		entity.SettingS3Region:    "us-east-1",
		entity.SettingS3Bucket:    "niubility",
		entity.SettingS3AccessKey: "ak",
		entity.SettingS3SecretKey: "sk",
	}); err != nil {
		t.Fatalf("UpdateSettingsBatch() error = %v", err)
	}

	operator := &entity.User{ID: "admin-1", Username: "admin", Name: "管理员"}
	_, err := s.StartDatabaseBackup(ctx, operator)
	if err != nil {
		t.Fatalf("StartDatabaseBackup() error = %v, want nil (legacy timeout should be recovered)", err)
	}

	// Verify the legacy record was force-failed
	var old entity.BackupRecord
	s.db.WithContext(ctx).Where("id = ?", legacyRecord.ID).First(&old)
	if old.Status != entity.BackupStatusFailed {
		t.Errorf("legacy record status = %q, want %q", old.Status, entity.BackupStatusFailed)
	}
}
