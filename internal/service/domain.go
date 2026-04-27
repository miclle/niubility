package service

import (
	"context"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

// ---------------------------------------------------------------------------
// Domain interfaces
//
// Each interface represents a cohesive business domain within the service
// layer. The concrete *Service struct implements all of them. Handler code
// and tests can depend on narrow interfaces instead of the full struct,
// improving testability and making domain boundaries explicit.
// ---------------------------------------------------------------------------

// SettingDomain covers system settings CRUD and typed config accessors.
type SettingDomain interface {
	GetSetting(ctx context.Context, key string) (string, error)
	SetSetting(ctx context.Context, key, value string) error
	ListSettings(ctx context.Context) ([]entity.Setting, error)
	UpdateSettingsBatch(ctx context.Context, settings map[string]string) error
	UpdateSettingsWithSideEffects(ctx context.Context, settings map[string]string) error
	GetWechatConfig(ctx context.Context) (*entity.WechatConfig, error)
	GetOIDCConfig(ctx context.Context) (*entity.OIDCConfig, error)
	GetSAMLConfig(ctx context.Context) (*entity.SAMLConfig, error)
	GetS3Config(ctx context.Context) (*entity.S3Config, error)
	GetDeliveryConfig(ctx context.Context) (*entity.DeliveryConfig, error)
	GetBackupConfig(ctx context.Context) (*entity.BackupConfig, error)
	GetSiteConfig(ctx context.Context) (*entity.SiteConfig, error)
	MigrateDeprecatedSettings(ctx context.Context)
}

// AuthDomain covers initialization, registration, and credential management.
type AuthDomain interface {
	InitSuperAdmin(ctx context.Context, username, email, password string) (*entity.User, error)
	RegisterUser(ctx context.Context, username, email, password string) (*entity.User, error)
	AuthenticateUser(ctx context.Context, username, password string) (*entity.User, error)
	HasPassword(ctx context.Context, userID string) (bool, error)
	ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error
	IsInitialized(ctx context.Context) bool
	IsRegistrationEnabled(ctx context.Context) bool
	GetSSOType(ctx context.Context) string
	IsCookieSecure(ctx context.Context) bool
	GetJWTSecret() string
}

// UserDomain covers user CRUD and search.
type UserDomain interface {
	GetUserByUsername(ctx context.Context, username string) (*entity.User, error)
	GetUserByID(ctx context.Context, id string) (*entity.User, error)
	ListUsers(ctx context.Context, args entity.ListUsersArgs) ([]entity.User, int64, string, error)
	CreateManagedUser(ctx context.Context, args entity.CreateUserArgs) (*entity.User, error)
	UpsertUser(ctx context.Context, username, email string) (*entity.User, error)
	CreateUser(ctx context.Context, user *entity.User) error
	UpdateUser(ctx context.Context, id string, args entity.UpdateUserArgs) (*entity.User, error)
	DeleteUser(ctx context.Context, id string) error
}

// SessionDomain covers user session lifecycle.
type SessionDomain interface {
	CreateUserSession(ctx context.Context, userID string, expiresAt time.Time, audit SessionAuditInfo) (*entity.UserSession, error)
	TouchUserSession(ctx context.Context, sessionID string, audit SessionAuditInfo) error
	RevokeUserSession(ctx context.Context, sessionID string) error
	GetUserSession(ctx context.Context, sessionID string) (*entity.UserSession, error)
	IsUserSessionActive(ctx context.Context, sessionID string) bool
}

// ContentDomain covers content CRUD and attachments.
type ContentDomain interface {
	ListContents(ctx context.Context, args entity.ListContentsArgs) ([]entity.Content, string, error)
	ListUserPublicContents(ctx context.Context, userID string, args entity.ListContentsArgs) ([]entity.Content, string, error)
	ListMyContents(ctx context.Context, userID string, args entity.ListContentsArgs) ([]entity.Content, string, error)
	GetContentByID(ctx context.Context, id string) (*entity.Content, error)
	CreateContent(ctx context.Context, content *entity.Content, attachments []entity.CreateAttachmentArgs) error
	UpdateContent(ctx context.Context, id string, args entity.UpdateContentArgs) (*entity.Content, error)
	DeleteContent(ctx context.Context, id string) error
}

// ContentViewDomain covers content view recording and history.
type ContentViewDomain interface {
	RecordContentView(ctx context.Context, userID, contentID string) error
	ListMyContentViews(ctx context.Context, userID string, args entity.ListMyContentViewsArgs) ([]entity.MyContentViewItem, string, error)
	ListContentViewUsers(ctx context.Context, contentID string, pagination entity.Pagination) ([]entity.ContentViewUserItem, string, error)
}

// CommentDomain covers comment CRUD and pinning.
type CommentDomain interface {
	ListComments(ctx context.Context, contentID, attachmentID string, pagination entity.Pagination) ([]entity.Comment, int64, string, error)
	CreateComment(ctx context.Context, comment *entity.Comment) error
	GetCommentByID(ctx context.Context, id string) (*entity.Comment, error)
	GetCommentWithUser(ctx context.Context, id string) (*entity.Comment, error)
	DeleteComment(ctx context.Context, id string) error
	ListMyComments(ctx context.Context, userID string, pagination entity.Pagination) ([]CommentWithContent, int64, string, error)
	PinComment(ctx context.Context, id string, pinned bool) (*entity.Comment, error)
}

// LikeDomain covers like toggle and queries.
type LikeDomain interface {
	ToggleLike(ctx context.Context, userID, targetID string, targetType entity.TargetType) (*entity.LikeResponse, error)
	IsLiked(ctx context.Context, userID, targetID string, targetType entity.TargetType) (bool, error)
	GetLikedIDs(ctx context.Context, userID string, targetIDs []string, targetType entity.TargetType) ([]string, error)
	ListMyLikesGroupedByContent(ctx context.Context, userID string, pagination entity.Pagination) ([]MyLikeContentSummary, int64, string, error)
}

// FavoriteDomain covers content favoriting.
type FavoriteDomain interface {
	ToggleFavorite(ctx context.Context, userID, contentID string) (*entity.FavoriteResponse, error)
	IsFavorited(ctx context.Context, userID, contentID string) (bool, error)
	ListFavorites(ctx context.Context, userID string, pagination entity.Pagination) ([]entity.Content, string, error)
}

// FollowDomain covers user following.
type FollowDomain interface {
	ToggleFollow(ctx context.Context, followerID, followingID string) (*entity.FollowResponse, error)
	IsFollowing(ctx context.Context, followerID, followingID string) (bool, error)
	ListFollowing(ctx context.Context, userID string, pagination entity.Pagination) ([]entity.User, string, error)
	ListFollowers(ctx context.Context, userID string, pagination entity.Pagination) ([]entity.User, string, error)
}

// CategoryDomain covers category management.
type CategoryDomain interface {
	ListCategories(ctx context.Context, visibleOnly bool) ([]entity.Category, error)
	GetCategoryContentCounts(ctx context.Context) (map[string]int64, error)
	GetCategoryByID(ctx context.Context, id string) (*entity.Category, error)
	CreateCategory(ctx context.Context, category *entity.Category) error
	UpdateCategory(ctx context.Context, id string, args entity.UpdateCategoryArgs) (*entity.Category, error)
	ReorderCategories(ctx context.Context, items []entity.ReorderCategoryItem) error
	DeleteCategory(ctx context.Context, id string) error
}

// UploadDomain covers S3 uploads, presigned URLs, and CORS configuration.
type UploadDomain interface {
	GetPresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error)
	GetAvatarPresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error)
	GetSiteResourcePresignedURL(ctx context.Context, filename, contentType string) (*PresignResult, error)
	GetFileURL(ctx context.Context, key, rawQuery string) (string, error)
	ConfigureS3CORS(ctx context.Context) error
}

// BackupDomain covers database backup operations.
type BackupDomain interface {
	StartDatabaseBackup(ctx context.Context, operator *entity.User) (*entity.BackupRecord, error)
	ListDatabaseBackups(ctx context.Context, page, pageSize int) ([]entity.BackupRecord, int64, error)
	GetDatabaseBackupDownloadURL(ctx context.Context, id string) (string, time.Time, error)
}

// NodeDomain covers service node heartbeat and listing.
type NodeDomain interface {
	UpsertServiceNodeHeartbeat(ctx context.Context, input ServiceNodeHeartbeatInput) error
	ListServiceNodes(ctx context.Context, input ListServiceNodesInput) (*ServiceNodeListResult, error)
	StartCurrentNodeHeartbeat(ctx context.Context, cfg CurrentNodeConfig)
}

// DepartmentDomain covers department sync and listing.
type DepartmentDomain interface {
	SyncDepartmentsFromWechat(ctx context.Context) (int, error)
	ListDepartments(ctx context.Context) ([]entity.Department, error)
	GetDepartmentUserCounts(ctx context.Context) (map[int64]int, error)
}

// WechatSyncDomain covers WeChat user synchronization.
type WechatSyncDomain interface {
	SyncUserFromWechat(ctx context.Context, username string) (*entity.User, error)
	SyncAllWechatUsers(ctx context.Context) (synced int, failed int, err error)
}

// ProfileDomain covers user profile operations.
type ProfileDomain interface {
	UpdateProfile(ctx context.Context, id string, args entity.UpdateProfileArgs) (*entity.User, error)
	GetUserContentCount(ctx context.Context, userID string) (int64, error)
	GetUserTotalLikes(ctx context.Context, userID string) (int64, error)
	GetUserSpeakerContentCount(ctx context.Context, userID string) (int64, error)
}

// ---------------------------------------------------------------------------
// Compile-time interface satisfaction checks
// ---------------------------------------------------------------------------

var (
	_ SettingDomain     = (*Service)(nil)
	_ AuthDomain        = (*Service)(nil)
	_ UserDomain        = (*Service)(nil)
	_ SessionDomain     = (*Service)(nil)
	_ ContentDomain     = (*Service)(nil)
	_ ContentViewDomain = (*Service)(nil)
	_ CommentDomain     = (*Service)(nil)
	_ LikeDomain        = (*Service)(nil)
	_ FavoriteDomain    = (*Service)(nil)
	_ FollowDomain      = (*Service)(nil)
	_ CategoryDomain    = (*Service)(nil)
	_ UploadDomain      = (*Service)(nil)
	_ BackupDomain      = (*Service)(nil)
	_ NodeDomain        = (*Service)(nil)
	_ DepartmentDomain  = (*Service)(nil)
	_ WechatSyncDomain  = (*Service)(nil)
	_ ProfileDomain     = (*Service)(nil)
)
