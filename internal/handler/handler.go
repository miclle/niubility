// Package handler provides HTTP handlers and route registration.
package handler

import (
	"github.com/fox-gonic/fox"

	"github.com/miclle/niubility/internal/service"
	"github.com/miclle/niubility/internal/website"
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

	// SSO callbacks and logout
	r.GET("/sso/callback", ctrl.SSOCallback) // OIDC callback
	r.POST("/sso/acs", ctrl.SSOAcs)          // SAML ACS
	r.GET("/sso/metadata", ctrl.SSOMetadata) // SAML SP metadata
	r.GET("/logout", ctrl.Logout)

	// health check
	r.GET("/health", ctrl.Health)

	// attachment access route (presigned redirect for S3 objects)
	r.GET("/attachments/*path", ctrl.GetAttachmentFile)
	r.GET("/avatars/*path", ctrl.GetAvatarFile)
	r.GET("/site-resources/*path", ctrl.GetSiteResourceFile)

	// API routes
	api := r.Group("/api/v1")
	api.GET("/boot", ctrl.Boot)
	api.POST("/init", ctrl.InitSystem)
	api.POST("/login", ctrl.Login)
	api.POST("/register", ctrl.Register)
	api.POST("/sso/cli/start", ctrl.CLISSOStart)
	api.GET("/sso/cli/login", ctrl.CLISSOLogin)
	api.POST("/sso/cli/exchange", ctrl.CLISSOExchange)

	// user search (authenticated users)
	api.GET("/users/search", ctrl.SearchUsers)

	// user profile (authenticated users)
	api.GET("/profile", ctrl.GetProfile)
	api.PATCH("/profile", ctrl.UpdateProfile)
	api.POST("/profile/upload", ctrl.GetAvatarPresignedURL)
	api.POST("/profile/change-password", ctrl.ChangePassword)
	api.GET("/profile/has-password", ctrl.HasPassword)
	api.GET("/users/:username/profile", ctrl.GetUserProfile)

	// content routes (authenticated users can CRUD their own content, admin can manage all)
	api.GET("/contents", ctrl.ListContents)
	api.GET("/contents/:id", ctrl.GetContent)
	api.POST("/contents/:id/favorite", ctrl.FavoriteContent)
	api.GET("/favorites", ctrl.ListFavorites)
	api.POST("/contents", ctrl.CreateContent)
	api.PUT("/contents/:id", ctrl.UpdateContent)
	api.DELETE("/contents/:id", ctrl.DeleteContent)

	// category routes (public read, admin write)
	api.GET("/categories", ctrl.ListCategories)

	// comment routes (new unified endpoints)
	api.GET("/comments", ctrl.ListCommentsQuery)
	api.POST("/comments", ctrl.CreateCommentBody)

	// like routes (new unified endpoint)
	api.POST("/likes", ctrl.ToggleLike)

	// follow routes (authenticated users)
	api.POST("/users/:username/follow", ctrl.ToggleFollow)
	api.GET("/users/:username/following", ctrl.ListFollowing)
	api.GET("/users/:username/followers", ctrl.ListFollowers)
	api.GET("/users/:username/favorites", ctrl.ListUserFavorites)

	// upload routes (authenticated users)
	api.POST("/upload/presign", ctrl.GetPresignedURL)

	// admin routes (all require admin role)
	admin := api.Group("/admin", ctrl.RequireAdmin)
	admin.GET("/users", ctrl.ListUsers)
	admin.POST("/users", ctrl.CreateUser)
	admin.GET("/users/:id", ctrl.GetUser)
	admin.PATCH("/users/:id", ctrl.UpdateUser)
	admin.DELETE("/users/:id", ctrl.DeleteUser)
	admin.GET("/settings", ctrl.ListSettings)
	admin.PATCH("/settings", ctrl.UpdateSettings)
	admin.POST("/upload/site-resource", ctrl.GetSiteResourcePresignedURL)
	admin.POST("/sync-wechat", ctrl.SyncFromWechat)
	admin.GET("/departments", ctrl.ListDepartments)
	admin.GET("/categories", ctrl.ListAllCategories)
	admin.POST("/categories", ctrl.CreateCategory)
	admin.POST("/categories/reorder", ctrl.ReorderCategories)
	admin.PUT("/categories/:id", ctrl.UpdateCategory)
	admin.DELETE("/categories/:id", ctrl.DeleteCategory)
	admin.POST("/comments/:id/pin", ctrl.PinComment)
}

// Health returns a simple health check response.
func (ctrl *Ctrl) Health(c *fox.Context) string {
	return "ok"
}
