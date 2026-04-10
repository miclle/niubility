package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
)

// StartDatabaseBackupResponse represents the response for triggering a backup.
type StartDatabaseBackupResponse struct {
	Backup entity.BackupRecord `json:"backup"`
}

// ListDatabaseBackupsArgs represents the query parameters for backup list.
type ListDatabaseBackupsArgs struct {
	Page     int `form:"page"`
	PageSize int `form:"page_size"`
}

// ListDatabaseBackupsResponse represents the response for listing backups.
type ListDatabaseBackupsResponse struct {
	Items []entity.BackupRecord `json:"items"`
	Total int64                 `json:"total"`
}

// DatabaseBackupDownloadResponse represents the response for backup download URLs.
type DatabaseBackupDownloadResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expires_at"`
}

// StartDatabaseBackup triggers a new database backup (admin only).
func (ctrl *Ctrl) StartDatabaseBackup(c *fox.Context) (*StartDatabaseBackupResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)

	record, err := ctrl.service.StartDatabaseBackup(ctx, user)
	if err != nil {
		if errors.Is(err, service.ErrDatabaseBackupRunning) {
			return nil, httperrors.New(http.StatusConflict, "已有数据库备份任务正在运行")
		}
		return nil, httperrors.New(http.StatusInternalServerError, err.Error())
	}
	return &StartDatabaseBackupResponse{Backup: *record}, nil
}

// ListDatabaseBackups returns database backup history (admin only).
func (ctrl *Ctrl) ListDatabaseBackups(c *fox.Context, args ListDatabaseBackupsArgs) (*ListDatabaseBackupsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	items, total, err := ctrl.service.ListDatabaseBackups(ctx, args.Page, args.PageSize)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return &ListDatabaseBackupsResponse{Items: items, Total: total}, nil
}

// GetDatabaseBackupDownloadURL returns a presigned download URL for a completed backup (admin only).
func (ctrl *Ctrl) GetDatabaseBackupDownloadURL(c *fox.Context) (*DatabaseBackupDownloadResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	url, expiresAt, err := ctrl.service.GetDatabaseBackupDownloadURL(ctx, c.Param("id"))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, httperrors.ErrNotFound
		}
		return nil, httperrors.New(http.StatusBadRequest, err.Error())
	}
	return &DatabaseBackupDownloadResponse{
		URL:       url,
		ExpiresAt: expiresAt,
	}, nil
}
