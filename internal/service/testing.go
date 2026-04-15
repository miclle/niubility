package service

import (
	"context"
	"io"
	"os/exec"
	"time"

	"gorm.io/gorm"
)

// NewTestService creates a Service suitable for testing from external packages.
// It uses the provided database and applies test-safe defaults (synchronous
// async runner, no-op command runner, no-op backup uploader).
func NewTestService(db *gorm.DB) *Service {
	svc := &Service{
		db:                   db,
		dialect:              "sqlite",
		jwtSecret:            "test-jwt-secret-for-handler-tests",
		nodeHeartbeatTimeout: 90 * time.Second,
		now:                  time.Now,
		commandRunner: func(ctx context.Context, name string, args []string, env []string, stdout, stderr io.Writer) error {
			return nil
		},
		backupUploader: func(ctx context.Context, localPath, objectKey string) error {
			return nil
		},
		asyncRunner: func(fn func()) {
			fn()
		},
		lookPath: func(file string) (string, error) {
			return "", exec.ErrNotFound
		},
		nativeDumper: func(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
			return nil
		},
	}
	return svc
}
