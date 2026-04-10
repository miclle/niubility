package service

import (
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

var ErrDatabaseBackupRunning = errors.New("database backup is already running")

type dbConnectionInfo struct {
	Host     string
	Port     string
	User     string
	Password string
	Database string
	SSLMode  string
}

// StartDatabaseBackup creates a running record and starts the backup task asynchronously.
func (s *Service) StartDatabaseBackup(ctx context.Context, operator *entity.User) (*entity.BackupRecord, error) {
	record, err := s.createRunningBackupRecord(ctx, operator)
	if err != nil {
		return nil, err
	}

	s.asyncRunner(func() {
		s.runDatabaseBackup(context.Background(), record.ID)
	})

	return record, nil
}

// ListDatabaseBackups returns database backup records ordered by start time descending.
func (s *Service) ListDatabaseBackups(ctx context.Context, page, pageSize int) ([]entity.BackupRecord, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	query := s.db.WithContext(ctx).Model(&entity.BackupRecord{}).Where("type = ?", entity.BackupTypeDatabase)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count backup records: %w", err)
	}

	var records []entity.BackupRecord
	if err := query.Order("started_at DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&records).Error; err != nil {
		return nil, 0, fmt.Errorf("list backup records: %w", err)
	}
	return records, total, nil
}

// GetDatabaseBackupDownloadURL returns a presigned download URL for a successful backup.
func (s *Service) GetDatabaseBackupDownloadURL(ctx context.Context, id string) (string, time.Time, error) {
	record, err := s.getBackupRecordByID(ctx, id)
	if err != nil {
		return "", time.Time{}, err
	}
	if record == nil {
		return "", time.Time{}, gorm.ErrRecordNotFound
	}
	if record.Status != entity.BackupStatusSuccess || strings.TrimSpace(record.ObjectKey) == "" {
		return "", time.Time{}, fmt.Errorf("backup is not downloadable")
	}

	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return "", time.Time{}, fmt.Errorf("s3 storage not configured")
	}

	backupCfg, err := s.GetBackupConfig(ctx)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("get backup config: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(backupCfg.DownloadURLTTLSeconds) * time.Second)
	client := s.newS3Client(cfg)
	presignClient := s3.NewPresignClient(client)
	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket:                     aws.String(cfg.Bucket),
		Key:                        aws.String(record.ObjectKey),
		ResponseContentDisposition: aws.String(fmt.Sprintf(`attachment; filename="%s"`, sanitizeContentDispositionFilename(record.FileName))),
	}, s3.WithPresignExpires(time.Duration(backupCfg.DownloadURLTTLSeconds)*time.Second))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("presign backup download: %w", err)
	}

	return req.URL, expiresAt, nil
}

func (s *Service) runDatabaseBackup(ctx context.Context, recordID string) {
	startedAt := time.Now()

	record, err := s.getBackupRecordByID(ctx, recordID)
	if err != nil || record == nil {
		return
	}

	tmpDir, err := os.MkdirTemp("", "niubility-db-backup-*")
	if err != nil {
		s.failBackup(ctx, record, startedAt, fmt.Errorf("create temp dir: %w", err))
		return
	}
	defer func() {
		_ = os.RemoveAll(tmpDir)
	}()

	info, err := parseDatabaseConnectionInfo(s.dialect, s.dsn)
	if err != nil {
		s.failBackup(ctx, record, startedAt, fmt.Errorf("parse database connection: %w", err))
		return
	}

	backupCfg, err := s.GetBackupConfig(ctx)
	if err != nil {
		s.failBackup(ctx, record, startedAt, fmt.Errorf("get backup config: %w", err))
		return
	}

	dumpBaseName := buildDatabaseBackupBaseName(record.StartedAt, s.dialect)
	dumpSQLPath := filepath.Join(tmpDir, dumpBaseName+".sql")
	archivePath := dumpSQLPath + ".gz"

	if err := s.dumpDatabaseToFile(ctx, info, dumpSQLPath); err != nil {
		s.failBackup(ctx, record, startedAt, err)
		return
	}

	size, checksum, err := gzipFile(dumpSQLPath, archivePath)
	if err != nil {
		s.failBackup(ctx, record, startedAt, fmt.Errorf("gzip backup file: %w", err))
		return
	}

	objectKey := buildDatabaseBackupObjectKey(backupCfg.S3Prefix, record.StartedAt, filepath.Base(archivePath))
	if err := s.backupUploader(ctx, archivePath, objectKey); err != nil {
		s.failBackup(ctx, record, startedAt, fmt.Errorf("upload backup file: %w", err))
		return
	}

	finishedAt := time.Now()
	updates := map[string]any{
		"status":          entity.BackupStatusSuccess,
		"lock_key":        nil,
		"object_key":      objectKey,
		"file_name":       filepath.Base(archivePath),
		"file_size":       size,
		"checksum_sha256": checksum,
		"finished_at":     &finishedAt,
		"duration_ms":     finishedAt.Sub(startedAt).Milliseconds(),
		"error_message":   "",
	}
	_ = s.db.WithContext(ctx).Model(&entity.BackupRecord{}).Where("id = ?", record.ID).Updates(updates).Error
}

func (s *Service) createRunningBackupRecord(ctx context.Context, operator *entity.User) (*entity.BackupRecord, error) {
	s.backupMutex.Lock()
	defer s.backupMutex.Unlock()

	if operator == nil {
		return nil, fmt.Errorf("operator is required")
	}

	lockKey := entity.BackupTypeDatabase
	record := &entity.BackupRecord{
		ID:              entity.ID(),
		Type:            entity.BackupTypeDatabase,
		Status:          entity.BackupStatusRunning,
		LockKey:         &lockKey,
		Driver:          s.dialect,
		Compressed:      true,
		StartedByUserID: operator.ID,
		StartedByName:   strings.TrimSpace(operator.Name),
		StartedAt:       time.Now(),
	}
	if record.StartedByName == "" {
		record.StartedByName = strings.TrimSpace(operator.Username)
	}

	if err := s.db.WithContext(ctx).Create(record).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) || isDuplicateConstraintError(err) {
			return nil, ErrDatabaseBackupRunning
		}
		return nil, fmt.Errorf("create backup record: %w", err)
	}

	return record, nil
}

func (s *Service) dumpDatabaseToFile(ctx context.Context, info *dbConnectionInfo, outputPath string) error {
	if info == nil {
		return fmt.Errorf("database connection info is nil")
	}

	output, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("create dump file: %w", err)
	}
	defer func() {
		_ = output.Close()
	}()

	var stderr strings.Builder
	name, args, env := s.buildDumpCommand(info)
	if name == "" {
		return fmt.Errorf("unsupported database driver: %s", s.dialect)
	}

	if err := s.commandRunner(ctx, name, args, env, output, &stderr); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("%s failed: %s", name, sanitizeBackupError(msg))
	}

	return nil
}

func (s *Service) buildDumpCommand(info *dbConnectionInfo) (string, []string, []string) {
	switch s.dialect {
	case "mysql":
		host := info.Host
		if host == "" {
			host = "127.0.0.1"
		}
		port := info.Port
		if port == "" {
			port = "3306"
		}
		args := []string{
			"--host", host,
			"--port", port,
			"--user", info.User,
			"--single-transaction",
			"--skip-lock-tables",
			"--routines",
			"--triggers",
			"--events",
			"--databases", info.Database,
		}
		env := []string{"MYSQL_PWD=" + info.Password}
		return "mysqldump", args, env
	default:
		host := info.Host
		if host == "" {
			host = "127.0.0.1"
		}
		port := info.Port
		if port == "" {
			port = "5432"
		}
		args := []string{
			"--host", host,
			"--port", port,
			"--username", info.User,
			"--dbname", info.Database,
			"--format", "plain",
			"--encoding", "UTF8",
			"--no-owner",
			"--no-privileges",
			"--verbose",
		}
		env := []string{"PGPASSWORD=" + info.Password}
		if info.SSLMode != "" {
			env = append(env, "PGSSLMODE="+info.SSLMode)
		}
		return "pg_dump", args, env
	}
}

func (s *Service) uploadBackupFile(ctx context.Context, localPath, objectKey string) error {
	cfg, err := s.GetS3Config(ctx)
	if err != nil {
		return fmt.Errorf("get s3 config: %w", err)
	}
	if cfg == nil {
		return fmt.Errorf("s3 storage not configured")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("open backup file: %w", err)
	}
	defer func() {
		_ = file.Close()
	}()

	client := s.newS3Client(cfg)
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(cfg.Bucket),
		Key:         aws.String(objectKey),
		Body:        file,
		ContentType: aws.String("application/gzip"),
		Metadata: map[string]string{
			"backup-type": entity.BackupTypeDatabase,
			"db-driver":   s.dialect,
		},
	})
	if err != nil {
		return fmt.Errorf("put object: %w", err)
	}
	return nil
}

func (s *Service) getBackupRecordByID(ctx context.Context, id string) (*entity.BackupRecord, error) {
	var record entity.BackupRecord
	if err := s.db.WithContext(ctx).Where("id = ?", id).Limit(1).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *Service) failBackup(ctx context.Context, record *entity.BackupRecord, startedAt time.Time, err error) {
	if record == nil || err == nil {
		return
	}
	finishedAt := time.Now()
	_ = s.db.WithContext(ctx).Model(&entity.BackupRecord{}).Where("id = ?", record.ID).Updates(map[string]any{
		"status":        entity.BackupStatusFailed,
		"lock_key":      nil,
		"finished_at":   &finishedAt,
		"duration_ms":   finishedAt.Sub(startedAt).Milliseconds(),
		"error_message": sanitizeBackupError(err.Error()),
	}).Error
}

func buildDatabaseBackupBaseName(now time.Time, driver string) string {
	return fmt.Sprintf("niubility-db-%s-%s", now.Format("20060102-150405"), driver)
}

func buildDatabaseBackupObjectKey(prefix string, now time.Time, fileName string) string {
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		prefix = "backups/database"
	}
	return path.Join(prefix, now.Format("2006"), now.Format("01"), now.Format("02"), fileName)
}

func gzipFile(srcPath, dstPath string) (int64, string, error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return 0, "", fmt.Errorf("open source file: %w", err)
	}
	defer func() {
		_ = src.Close()
	}()

	dst, err := os.Create(dstPath)
	if err != nil {
		return 0, "", fmt.Errorf("create archive file: %w", err)
	}
	defer func() {
		_ = dst.Close()
	}()

	hasher := sha256.New()
	writer := io.MultiWriter(dst, hasher)
	gzipWriter := gzip.NewWriter(writer)
	if _, err := io.Copy(gzipWriter, src); err != nil {
		_ = gzipWriter.Close()
		return 0, "", fmt.Errorf("write gzip content: %w", err)
	}
	if err := gzipWriter.Close(); err != nil {
		return 0, "", fmt.Errorf("close gzip writer: %w", err)
	}

	info, err := dst.Stat()
	if err != nil {
		return 0, "", fmt.Errorf("stat archive file: %w", err)
	}
	return info.Size(), hex.EncodeToString(hasher.Sum(nil)), nil
}

func parseDatabaseConnectionInfo(driver, dsn string) (*dbConnectionInfo, error) {
	switch driver {
	case "mysql":
		return parseMySQLConnectionInfo(dsn)
	default:
		return parsePostgresConnectionInfo(dsn)
	}
}

func parseMySQLConnectionInfo(dsn string) (*dbConnectionInfo, error) {
	cfg, err := mysqlDriver.ParseDSN(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse mysql dsn: %w", err)
	}
	host := "127.0.0.1"
	port := "3306"
	if cfg.Addr != "" {
		if h, p, splitErr := net.SplitHostPort(cfg.Addr); splitErr == nil {
			host = h
			port = p
		}
	}

	return &dbConnectionInfo{
		Host:     host,
		Port:     port,
		User:     cfg.User,
		Password: cfg.Passwd,
		Database: cfg.DBName,
	}, nil
}

func parsePostgresConnectionInfo(dsn string) (*dbConnectionInfo, error) {
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse postgres dsn: %w", err)
	}

	port := "5432"
	if cfg.Port != 0 {
		port = strconv.FormatUint(uint64(cfg.Port), 10)
	}
	return &dbConnectionInfo{
		Host:     cfg.Host,
		Port:     port,
		User:     cfg.User,
		Password: cfg.Password,
		Database: cfg.Database,
		SSLMode:  firstNonEmpty(cfg.RuntimeParams["sslmode"], extractPostgresSSLMode(cfg.ConnString())),
	}, nil
}

func sanitizeBackupError(message string) string {
	message = strings.TrimSpace(message)
	if message == "" {
		return "backup failed"
	}
	for _, marker := range []string{"password=", "postgres://", "postgresql://", "@tcp("} {
		if idx := strings.Index(strings.ToLower(message), marker); idx >= 0 {
			return strings.TrimSpace(message[:idx]) + " [redacted]"
		}
	}
	return message
}

func sanitizeContentDispositionFilename(fileName string) string {
	fileName = strings.TrimSpace(fileName)
	if fileName == "" {
		return "database-backup.sql.gz"
	}
	return strings.NewReplacer(`"`, "", "\n", "", "\r", "").Replace(fileName)
}

func extractPostgresSSLMode(dsn string) string {
	for _, field := range strings.Fields(dsn) {
		if !strings.HasPrefix(field, "sslmode=") {
			continue
		}
		return strings.Trim(strings.TrimPrefix(field, "sslmode="), `'"`)
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func isDuplicateConstraintError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}

	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "unique failed")
}
