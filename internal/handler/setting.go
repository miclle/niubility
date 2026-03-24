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

	if err := ctrl.service.UpdateSettingsBatch(ctx, req.Settings); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Check if WeChat settings were updated
	wechatKeys := []string{
		entity.SettingWechatCorpID,
		entity.SettingWechatAppAgentID,
		entity.SettingWechatAppSecret,
	}
	shouldRefreshWechat := false
	for _, key := range wechatKeys {
		if _, ok := req.Settings[key]; ok {
			shouldRefreshWechat = true
			break
		}
	}

	if shouldRefreshWechat {
		if err := ctrl.service.RefreshWechatClient(ctx); err != nil {
			return nil, httperrors.ErrInternalServerError
		}
	}

	// Check if S3 settings were updated, configure CORS if needed
	s3Keys := []string{
		entity.SettingS3Endpoint,
		entity.SettingS3Region,
		entity.SettingS3Bucket,
		entity.SettingS3AccessKey,
		entity.SettingS3SecretKey,
		entity.SettingS3CORSOrigin,
	}
	shouldConfigureCORS := false
	for _, key := range s3Keys {
		if _, ok := req.Settings[key]; ok {
			shouldConfigureCORS = true
			break
		}
	}

	if shouldConfigureCORS {
		if err := ctrl.service.ConfigureS3CORS(ctx); err != nil {
			c.Logger.Warnf("UpdateSettings: configure S3 CORS failed: %v", err)
		}
	}

	// Return updated settings
	settings, err := ctrl.service.ListSettings(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	return &ListSettingsResponse{Settings: settings}, nil
}
