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
	secret  string // JWT signing secret
}

// New creates a new Ctrl instance.
func New(svc *service.Service, secret string) *Ctrl {
	return &Ctrl{
		service: svc,
		secret:  secret,
	}
}

// RegisterRoutes registers all API routes on the given engine.
func (ctrl *Ctrl) RegisterRoutes(r *fox.Engine) {
	// embed website assets
	website.EmbedAssets(r)

	// public routes
	r.POST("/api/v1/login", ctrl.Login)
	r.GET("/health", ctrl.Health)

	// authenticated routes
	api := r.Group("/api/v1", ctrl.AuthMiddleware)
	api.GET("/boot", ctrl.Boot)

	// content routes (authenticated users can read, admin can write)
	api.GET("/contents", ctrl.ListContents)
	api.GET("/contents/:id", ctrl.GetContent)
	api.POST("/contents", ctrl.RequireAdmin, ctrl.CreateContent)
	api.PUT("/contents/:id", ctrl.RequireAdmin, ctrl.UpdateContent)
	api.DELETE("/contents/:id", ctrl.RequireAdmin, ctrl.DeleteContent)

	// admin-only user management
	admin := api.Group("", ctrl.RequireAdmin)
	admin.GET("/users", ctrl.ListUsers)
	admin.PATCH("/users/:id", ctrl.UpdateUser)
}

// Health returns a simple health check response.
func (ctrl *Ctrl) Health(c *fox.Context) string {
	return "ok"
}
