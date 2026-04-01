package handler

import (
	"context"
	"fmt"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/pkg/sso"
)

// SSOCallbackArgs represents the OIDC callback query parameters.
type SSOCallbackArgs struct {
	Code  string `query:"code"`
	State string `query:"state"`
}

// SSOCallback handles the OIDC authorization code callback.
func (ctrl *Ctrl) SSOCallback(c *fox.Context, args *SSOCallbackArgs) any {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "oidc" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	provider, err := ctrl.getOIDCProvider(ctx)
	if err != nil {
		c.Logger.Errorf("get OIDC provider: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := provider.Exchange(ctx, sso.CallbackParams{Code: args.Code, State: args.State})
	if err != nil {
		c.Logger.Errorf("OIDC exchange failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	redirect, err := ctrl.validateSSOState(c, args.State)
	if err == nil {
		return ctrl.completeSSOLogin(c, userinfo, redirect)
	}

	callbackURL, cliErr := ctrl.validateCLISSOState(args.State)
	if cliErr == nil {
		return ctrl.completeCLISSOLogin(c, callbackURL, userinfo)
	}

	c.Logger.Errorf("invalid SSO state: web=%v cli=%v", err, cliErr)
	return render.Redirect{Code: 302, Location: "/login"}
}

// getOIDCProvider creates an OIDC provider from database settings.
func (ctrl *Ctrl) getOIDCProvider(ctx context.Context) (*sso.OIDCProvider, error) {
	cfg, err := ctrl.service.GetOIDCConfig(ctx)
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("OIDC not configured")
	}
	return sso.NewOIDCProvider(ctx, cfg.Issuer, cfg.ClientID, cfg.ClientSecret)
}
