package handler

import (
	"encoding/json"
	"encoding/xml"
	"fmt"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"

	"github.com/miclle/niubility/pkg/sso"
)

// SSOAcsArgs represents the SAML ACS POST form parameters.
type SSOAcsArgs struct {
	SAMLResponse string `form:"SAMLResponse"`
	RelayState   string `form:"RelayState"`
}

// SSOAcs handles the SAML 2.0 Assertion Consumer Service callback.
func (ctrl *Ctrl) SSOAcs(c *fox.Context, args *SSOAcsArgs) any {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "saml" {
		return render.Redirect{Code: 302, Location: "/login"}
	}

	provider, err := ctrl.getSAMLProvider(c)
	if err != nil {
		c.Logger.Errorf("get SAML provider: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	userinfo, err := provider.Exchange(c, sso.CallbackParams{SAMLResponse: args.SAMLResponse, RelayState: args.RelayState})
	if err != nil {
		c.Logger.Errorf("SAML exchange failed: %v", err)
		return render.Redirect{Code: 302, Location: "/500"}
	}

	callbackURL, cliErr := ctrl.validateCLISSOState(args.RelayState)
	if cliErr == nil {
		return ctrl.completeCLISSOLogin(c, callbackURL, userinfo)
	}

	redirect := args.RelayState
	return ctrl.completeSSOLogin(c, userinfo, redirect)
}

// SSOMetadata returns the SAML SP metadata XML for IdP import.
func (ctrl *Ctrl) SSOMetadata(c *fox.Context) any {
	ctx := c.Logger.WithContext(c.Request.Context())

	if ctrl.service.GetSSOType(ctx) != "saml" {
		return httperrors.ErrNotFound
	}

	provider, err := ctrl.getSAMLProvider(c)
	if err != nil {
		c.Logger.Errorf("get SAML provider: %v", err)
		return httperrors.ErrInternalServerError
	}

	metadata := provider.Metadata()
	c.Header("Content-Type", "application/samlmetadata+xml")
	xmlBytes, _ := xml.MarshalIndent(metadata, "", "  ")
	c.Writer.Write(xmlBytes) //nolint:errcheck
	return nil
}

// getSAMLProvider creates a SAML provider from database settings.
func (ctrl *Ctrl) getSAMLProvider(c *fox.Context) (*sso.SAMLProvider, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	cfg, err := ctrl.service.GetSAMLConfig(ctx)
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("SAML not configured")
	}

	// Fetch and parse IdP metadata
	metadata, err := sso.ParseIDPMetadata(ctx, cfg.IDPMetadataURL)
	if err != nil {
		return nil, fmt.Errorf("parse IdP metadata: %w", err)
	}

	// Parse attribute mapping JSON
	var attrMapping map[string]string
	if cfg.AttributeMapping != "" {
		if err := json.Unmarshal([]byte(cfg.AttributeMapping), &attrMapping); err != nil {
			return nil, fmt.Errorf("parse attribute mapping: %w", err)
		}
	}

	return sso.NewSAMLProvider(sso.SAMLConfig{
		IDPEntityID:      metadata.EntityID,
		IDPSSOURL:        metadata.SSOURL,
		IDPCertificate:   metadata.Certificate,
		SPEntityID:       ctrl.baseURL(c) + "/sso/metadata",
		SPACSURL:         ctrl.baseURL(c) + "/sso/acs",
		SPCertificate:    cfg.SPCertificate,
		SPPrivateKey:     cfg.SPPrivateKey,
		NameIDFormat:     cfg.NameIDFormat,
		AttributeMapping: attrMapping,
	})
}
