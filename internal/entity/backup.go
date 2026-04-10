package entity

import "time"

const (
	BackupTypeDatabase = "database"

	BackupStatusRunning = "running"
	BackupStatusSuccess = "success"
	BackupStatusFailed  = "failed"
)

// BackupRecord stores metadata for a generated backup artifact.
type BackupRecord struct {
	ID              string     `json:"id"                 gorm:"column:id;primaryKey;size:36"`
	Type            string     `json:"type"               gorm:"column:type;size:32;index"`
	Status          string     `json:"status"             gorm:"column:status;size:32;index"`
	Driver          string     `json:"driver"             gorm:"column:driver;size:16"`
	ObjectKey       string     `json:"object_key"         gorm:"column:object_key;type:text"`
	FileName        string     `json:"file_name"          gorm:"column:file_name;type:text"`
	FileSize        int64      `json:"file_size"          gorm:"column:file_size"`
	Compressed      bool       `json:"compressed"         gorm:"column:compressed"`
	ChecksumSHA256  string     `json:"checksum_sha256"    gorm:"column:checksum_sha256;size:64"`
	StartedByUserID string     `json:"started_by_user_id" gorm:"column:started_by_user_id;size:36"`
	StartedByName   string     `json:"started_by_name"    gorm:"column:started_by_name;size:128"`
	StartedAt       time.Time  `json:"started_at"         gorm:"column:started_at"`
	FinishedAt      *time.Time `json:"finished_at"        gorm:"column:finished_at"`
	DurationMs      int64      `json:"duration_ms"        gorm:"column:duration_ms"`
	ErrorMessage    string     `json:"error_message"      gorm:"column:error_message;type:text"`
	CreatedAt       time.Time  `json:"created_at"         gorm:"column:created_at"`
	UpdatedAt       time.Time  `json:"updated_at"         gorm:"column:updated_at"`
}

// TableName specifies the database table name.
func (BackupRecord) TableName() string {
	return "backup_records"
}
