package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// ListSettingsResponse represents the response for listing settings.
type ListSettingsResponse struct {
	Settings []entity.Setting `json:"settings"`
}

// UpdateSettingsRequest represents the request body for updating settings.
type UpdateSettingsRequest struct {
	Settings map[string]string `json:"settings" binding:"required"`
}

// ListSettings returns all settings (admin only).
func (ctrl *Ctrl) ListSettings(c *fox.Context) (*ListSettingsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	settings, err := ctrl.service.ListSettings(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return &ListSettingsResponse{Settings: settings}, nil
}

// UpdateSettings updates the settings and refreshes related services if needed.
func (ctrl *Ctrl) UpdateSettings(c *fox.Context, req *UpdateSettingsRequest) (*ListSettingsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	if err := ctrl.service.UpdateSettingsWithSideEffects(ctx, req.Settings); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Return updated settings
	settings, err := ctrl.service.ListSettings(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return &ListSettingsResponse{Settings: settings}, nil
}
