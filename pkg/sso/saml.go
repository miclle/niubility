package sso

import (
	"context"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"net/url"

	"github.com/crewjam/saml"
)

// SAMLProvider implements the Provider interface using SAML 2.0.
type SAMLProvider struct {
	idpEntityID    string
	idpSSOURL      string
	idpCertificate *x509.Certificate
	spEntityID     string
	spACSURL       string
}

// SAMLConfig holds the configuration for creating a SAML provider.
type SAMLConfig struct {
	IDPEntityID    string
	IDPSSOURL      string
	IDPCertificate string // PEM-encoded certificate
	SPEntityID     string // e.g. "https://app.example.com/sso/metadata"
	SPACSURL       string // e.g. "https://app.example.com/sso/acs"
}

// NewSAMLProvider creates a SAML 2.0 SP provider from the given configuration.
func NewSAMLProvider(cfg SAMLConfig) (*SAMLProvider, error) {
	var cert *x509.Certificate
	if cfg.IDPCertificate != "" {
		block, _ := pem.Decode([]byte(cfg.IDPCertificate))
		if block == nil {
			return nil, fmt.Errorf("failed to decode IdP certificate PEM")
		}
		var err error
		cert, err = x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse IdP certificate: %w", err)
		}
	}

	return &SAMLProvider{
		idpEntityID:    cfg.IDPEntityID,
		idpSSOURL:      cfg.IDPSSOURL,
		idpCertificate: cert,
		spEntityID:     cfg.SPEntityID,
		spACSURL:       cfg.SPACSURL,
	}, nil
}

// boolPtr returns a pointer to a bool value.
func boolPtr(b bool) *bool { return &b }

// AuthURL constructs a SAML AuthnRequest redirect URL.
// The state parameter is passed as RelayState.
func (p *SAMLProvider) AuthURL(state, _ string) string {
	nameIDFormat := string(saml.UnspecifiedNameIDFormat)
	req := saml.AuthnRequest{
		AssertionConsumerServiceURL: p.spACSURL,
		Destination:                 p.idpSSOURL,
		Issuer: &saml.Issuer{
			Value: p.spEntityID,
		},
		NameIDPolicy: &saml.NameIDPolicy{
			AllowCreate: boolPtr(true),
			Format:      &nameIDFormat,
		},
		Version: "2.0",
	}

	reqBuf, _ := xml.Marshal(req)
	encoded := base64.StdEncoding.EncodeToString(reqBuf)

	u, _ := url.Parse(p.idpSSOURL)
	q := u.Query()
	q.Set("SAMLRequest", encoded)
	if state != "" {
		q.Set("RelayState", state)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// Exchange parses the SAML Response and extracts user info.
func (p *SAMLProvider) Exchange(_ context.Context, params CallbackParams) (*UserInfo, error) {
	rawResp, err := base64.StdEncoding.DecodeString(params.SAMLResponse)
	if err != nil {
		return nil, fmt.Errorf("decode SAMLResponse: %w", err)
	}

	var resp saml.Response
	if err := xml.Unmarshal(rawResp, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal SAMLResponse: %w", err)
	}

	if resp.Status.StatusCode.Value != saml.StatusSuccess {
		return nil, fmt.Errorf("SAML response status: %s", resp.Status.StatusCode.Value)
	}

	if resp.Assertion == nil {
		return nil, fmt.Errorf("no assertion in SAML response")
	}

	assertion := resp.Assertion

	// Extract attributes from the assertion
	info := &UserInfo{}
	for _, stmt := range assertion.AttributeStatements {
		for _, attr := range stmt.Attributes {
			if len(attr.Values) == 0 {
				continue
			}
			val := attr.Values[0].Value
			switch attr.Name {
			case "username", "uid", "urn:oid:0.9.2342.19200300.100.1.1":
				info.Username = val
			case "email", "mail", "urn:oid:0.9.2342.19200300.100.1.3":
				info.Email = val
			case "name", "displayName", "urn:oid:2.16.840.1.113730.3.1.241":
				info.Name = val
			}
		}
	}

	// Fallback: use NameID as username
	if info.Username == "" && assertion.Subject != nil && assertion.Subject.NameID != nil {
		info.Username = assertion.Subject.NameID.Value
	}

	if info.Username == "" {
		return nil, fmt.Errorf("could not determine username from SAML assertion")
	}

	return info, nil
}

// Metadata returns the SAML SP metadata XML for IdP import.
func (p *SAMLProvider) Metadata() *saml.EntityDescriptor {
	return &saml.EntityDescriptor{
		EntityID: p.spEntityID,
		SPSSODescriptors: []saml.SPSSODescriptor{
			{
				SSODescriptor: saml.SSODescriptor{
					RoleDescriptor: saml.RoleDescriptor{
						ProtocolSupportEnumeration: "urn:oasis:names:tc:SAML:2.0:protocol",
					},
					NameIDFormats: []saml.NameIDFormat{
						saml.UnspecifiedNameIDFormat,
						saml.EmailAddressNameIDFormat,
					},
				},
				AuthnRequestsSigned:  boolPtr(false),
				WantAssertionsSigned: boolPtr(true),
				AssertionConsumerServices: []saml.IndexedEndpoint{
					{
						Binding:  saml.HTTPPostBinding,
						Location: p.spACSURL,
						Index:    0,
					},
				},
			},
		},
	}
}
