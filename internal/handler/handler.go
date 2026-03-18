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

	// API routes
	api := r.Group("/api/v1")
	api.GET("/boot", ctrl.Boot)
	api.POST("/init", ctrl.InitSystem)
	api.POST("/login", ctrl.Login)
	api.POST("/register", ctrl.Register)

	// user search (authenticated users)
	api.GET("/users/search", ctrl.SearchUsers)

	// content routes (authenticated users can read, admin can write)
	api.GET("/contents", ctrl.ListContents)
	api.GET("/contents/:id", ctrl.GetContent)
	api.POST("/contents/:id/comments", ctrl.CreateComment)
	api.GET("/contents/:id/comments", ctrl.ListComments)
	api.POST("/contents/:id/like", ctrl.LikeContent)
	api.POST("/contents", ctrl.RequireAdmin, ctrl.CreateContent)
	api.PUT("/contents/:id", ctrl.RequireAdmin, ctrl.UpdateContent)
	api.DELETE("/contents/:id", ctrl.RequireAdmin, ctrl.DeleteContent)

	// category routes (public read, admin write)
	api.GET("/categories", ctrl.ListCategories)

	// comment routes
	api.POST("/comments/:id/like", ctrl.LikeComment)

	// import routes (admin only)
	api.POST("/import", ctrl.RequireAdmin, ctrl.ImportContents)

	// upload routes (admin only)
	api.POST("/upload/presign", ctrl.RequireAdmin, ctrl.GetPresignedURL)

	// admin routes (all require admin role)
	admin := api.Group("/admin", ctrl.RequireAdmin)
	admin.GET("/users", ctrl.ListUsers)
	admin.PATCH("/users/:id", ctrl.UpdateUser)
	admin.GET("/settings", ctrl.ListSettings)
	admin.PATCH("/settings", ctrl.UpdateSettings)
	admin.POST("/sync-wechat", ctrl.SyncFromWechat)
	admin.GET("/departments", ctrl.ListDepartments)
	admin.GET("/categories", ctrl.ListAllCategories)
	admin.POST("/categories", ctrl.CreateCategory)
	admin.POST("/categories/reorder", ctrl.ReorderCategories)
	admin.PUT("/categories/:id", ctrl.UpdateCategory)
	admin.DELETE("/categories/:id", ctrl.DeleteCategory)
}

// Health returns a simple health check response.
func (ctrl *Ctrl) Health(c *fox.Context) string {
	return "ok"
}
