// Package handler provides HTTP handlers and route registration.
package handler

import (
	"github.com/fox-gonic/fox"

	"github.com/miclle/niubility/internal/service"
	"github.com/miclle/niubility/website"
)

// Ctrl is the controller that holds service dependencies and registers routes.
type Ctrl struct {
	service *service.Service
}

// New creates a new Ctrl instance.
func New(svc *service.Service) *Ctrl {
	return &Ctrl{
		service: svc,
	}
}

// RegisterRoutes registers all API routes on the given engine.
func (ctrl *Ctrl) RegisterRoutes(r *fox.Engine) {
	// global auth middleware
	r.Use(ctrl.AuthMiddleware)

	// embed website assets
	website.EmbedAssets(r)

	// ── SSO & auth callbacks ────────────────────────────────────────────
	r.GET("/sso/callback", ctrl.SSOCallback) // OIDC callback
	r.POST("/sso/acs", ctrl.SSOAcs)          // SAML ACS
	r.GET("/sso/metadata", ctrl.SSOMetadata) // SAML SP metadata
	r.GET("/logout", ctrl.Logout)

	// ── Health check ────────────────────────────────────────────────────
	r.GET("/health", ctrl.Health)

	// ── File access (presigned redirect for S3 objects) ─────────────────
	r.GET("/attachments/*path", ctrl.GetAttachmentFile)
	r.GET("/avatars/*path", ctrl.GetAvatarFile)
	r.GET("/site-resources/*path", ctrl.GetSiteResourceFile)

	// ── Public / unauthenticated API ────────────────────────────────────
	api := r.Group("/api/v1")
	api.GET("/boot", ctrl.Boot)
	api.POST("/init", ctrl.InitSystem)
	api.POST("/login", ctrl.Login)
	api.POST("/register", ctrl.Register)
	api.POST("/sso/cli/start", ctrl.CLISSOStart)
	api.GET("/sso/cli/login", ctrl.CLISSOLogin)
	api.POST("/sso/cli/exchange", ctrl.CLISSOExchange)

	// ── User search ─────────────────────────────────────────────────────
	api.GET("/users/search", ctrl.SearchUsers)

	// ── User profile ────────────────────────────────────────────────────
	api.GET("/profile", ctrl.GetProfile)
	api.PATCH("/profile", ctrl.UpdateProfile)
	api.GET("/profile/contents", ctrl.ListMyContents)
	api.POST("/profile/upload", ctrl.GetAvatarPresignedURL)
	api.POST("/profile/change-password", ctrl.ChangePassword)
	api.GET("/profile/has-password", ctrl.HasPassword)
	api.GET("/users/:username/profile", ctrl.GetUserProfile)
	api.GET("/users/:username/contents", ctrl.ListUserContents)

	// ── Content CRUD ────────────────────────────────────────────────────
	api.GET("/contents", ctrl.ListContents)
	api.GET("/contents/:id", ctrl.GetContent)
	api.POST("/contents/:id/view", ctrl.RecordContentView)
	api.POST("/contents/:id/favorite", ctrl.FavoriteContent)
	api.GET("/favorites", ctrl.ListFavorites)
	api.GET("/views/mine", ctrl.ListMyContentViews)
	api.POST("/contents", ctrl.CreateContent)
	api.PUT("/contents/:id", ctrl.UpdateContent)
	api.DELETE("/contents/:id", ctrl.DeleteContent)

	// ── Categories (public read) ────────────────────────────────────────
	api.GET("/categories", ctrl.ListCategories)

	// ── Comments ────────────────────────────────────────────────────────
	api.GET("/comments", ctrl.ListCommentsQuery)
	api.GET("/comments/mine", ctrl.ListMyComments)
	api.POST("/comments", ctrl.CreateCommentBody)
	api.DELETE("/comments/:id", ctrl.DeleteComment)

	// ── Likes ───────────────────────────────────────────────────────────
	api.GET("/likes/mine", ctrl.ListMyLikes)
	api.POST("/likes", ctrl.ToggleLike)

	// ── Follows ─────────────────────────────────────────────────────────
	api.POST("/users/:username/follow", ctrl.ToggleFollow)
	api.GET("/users/:username/following", ctrl.ListFollowing)
	api.GET("/users/:username/followers", ctrl.ListFollowers)
	api.GET("/users/:username/favorites", ctrl.ListUserFavorites)

	// ── Upload ──────────────────────────────────────────────────────────
	api.POST("/upload/presign", ctrl.GetPresignedURL)

	// ── Admin routes (require admin role) ───────────────────────────────
	admin := api.Group("/admin", ctrl.RequireAdmin)

	// Admin: user management
	admin.GET("/users", ctrl.ListUsers)
	admin.POST("/users", ctrl.CreateUser)
	admin.GET("/users/:id", ctrl.GetUser)
	admin.PATCH("/users/:id", ctrl.UpdateUser)
	admin.DELETE("/users/:id", ctrl.DeleteUser)

	// Admin: settings
	admin.GET("/settings", ctrl.ListSettings)
	admin.PATCH("/settings", ctrl.UpdateSettings)

	// Admin: database backup
	admin.GET("/backups/database", ctrl.ListDatabaseBackups)
	admin.POST("/backups/database", ctrl.StartDatabaseBackup)
	admin.GET("/backups/database/:id/download", ctrl.GetDatabaseBackupDownloadURL)

	// Admin: service nodes
	admin.GET("/nodes", ctrl.ListServiceNodes)

	// Admin: upload
	admin.POST("/upload/site-resource", ctrl.GetSiteResourcePresignedURL)

	// Admin: WeChat sync & departments
	admin.POST("/sync-wechat", ctrl.SyncFromWechat)
	admin.GET("/departments", ctrl.ListDepartments)

	// Admin: content views
	admin.GET("/contents/:id/views", ctrl.ListContentViewUsers)

	// Admin: categories (full CRUD)
	admin.GET("/categories", ctrl.ListAllCategories)
	admin.POST("/categories", ctrl.CreateCategory)
	admin.POST("/categories/reorder", ctrl.ReorderCategories)
	admin.PUT("/categories/:id", ctrl.UpdateCategory)
	admin.DELETE("/categories/:id", ctrl.DeleteCategory)

	// Admin: comment moderation
	admin.POST("/comments/:id/pin", ctrl.PinComment)
	admin.PATCH("/contents/:id/moderation", ctrl.ModerateContent)
}

// Health returns a simple health check response.
func (ctrl *Ctrl) Health(c *fox.Context) string {
	return "ok"
}
