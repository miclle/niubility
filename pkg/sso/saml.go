package sso

import (
	"bytes"
	"compress/flate"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/crewjam/saml"
)

// httpClient is used for fetching metadata. Can be overridden for testing.
var httpClient = &http.Client{Timeout: 10 * time.Second}

// IDPMetadata contains the parsed IdP metadata information.
type IDPMetadata struct {
	EntityID    string
	SSOURL      string
	Certificate string // PEM-encoded certificate
}

// ParseIDPMetadata fetches and parses SAML IdP metadata from the given URL.
func ParseIDPMetadata(ctx context.Context, metadataURL string) (*IDPMetadata, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", metadataURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch metadata: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch metadata: status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read metadata: %w", err)
	}

	return ParseIDPMetadataXML(data)
}

// ParseIDPMetadataXML parses SAML IdP metadata from XML bytes.
func ParseIDPMetadataXML(data []byte) (*IDPMetadata, error) {
	// Use crewjam/saml to parse the metadata
	metadata := &saml.EntityDescriptor{}
	if err := xml.Unmarshal(data, metadata); err != nil {
		return nil, fmt.Errorf("parse metadata XML: %w", err)
	}

	result := &IDPMetadata{
		EntityID: metadata.EntityID,
	}

	// Extract from IDPSSODescriptor
	if len(metadata.IDPSSODescriptors) > 0 {
		idp := metadata.IDPSSODescriptors[0]

		// Get SSO URL from SingleSignOnService (prefer HTTP-Redirect binding)
		for _, sso := range idp.SingleSignOnServices {
			if sso.Binding == string(saml.HTTPRedirectBinding) || sso.Binding == string(saml.HTTPPostBinding) {
				result.SSOURL = sso.Location
				break
			}
		}

		// Get signing certificate
		for _, kd := range idp.KeyDescriptors {
			if kd.Use == "signing" || kd.Use == "" {
				if len(kd.KeyInfo.X509Data.X509Certificates) > 0 {
					certData := kd.KeyInfo.X509Data.X509Certificates[0].Data
					result.Certificate = certToPEM(certData)
					break
				}
			}
		}
	}

	if result.EntityID == "" {
		return nil, fmt.Errorf("metadata missing EntityID")
	}

	return result, nil
}

// certToPEM converts a base64 certificate to PEM format.
func certToPEM(base64Cert string) string {
	cert := strings.TrimSpace(base64Cert)
	return "-----BEGIN CERTIFICATE-----\n" + cert + "\n-----END CERTIFICATE-----"
}

// SAMLProvider implements the Provider interface using SAML 2.0.
type SAMLProvider struct {
	idpEntityID    string
	idpSSOURL      string
	idpCertificate *x509.Certificate
	spEntityID     string
	spACSURL       string
	// SP signing support
	spCertificate *x509.Certificate
	spPrivateKey  *rsa.PrivateKey
	// NameID format
	nameIDFormat saml.NameIDFormat
	// Attribute mapping
	attributeMapping map[string]string
}

// SAMLConfig holds the configuration for creating a SAML provider.
type SAMLConfig struct {
	// IdP configuration
	IDPEntityID    string
	IDPSSOURL      string
	IDPCertificate string // PEM-encoded certificate
	// SP configuration
	SPEntityID string // e.g. "https://app.example.com/sso/metadata"
	SPACSURL   string // e.g. "https://app.example.com/sso/acs"
	// SP signing configuration (optional)
	SPCertificate string // PEM-encoded SP certificate
	SPPrivateKey  string // PEM-encoded SP private key
	// NameID format (optional, default: unspecified)
	NameIDFormat string // "unspecified", "email", "transient", "persistent"
	// Attribute mapping (optional)
	AttributeMapping map[string]string // {"uid": "username", "mail": "email", "displayName": "name"}
}

// nameIDFormatMapping maps string format names to saml.NameIDFormat values.
var nameIDFormatMapping = map[string]saml.NameIDFormat{
	"unspecified": saml.UnspecifiedNameIDFormat,
	"email":       saml.EmailAddressNameIDFormat,
	"transient":   saml.TransientNameIDFormat,
	"persistent":  saml.PersistentNameIDFormat,
}

// NewSAMLProvider creates a SAML 2.0 SP provider from the given configuration.
func NewSAMLProvider(cfg SAMLConfig) (*SAMLProvider, error) {
	// Parse IdP certificate
	var idpCert *x509.Certificate
	if cfg.IDPCertificate != "" {
		block, _ := pem.Decode([]byte(cfg.IDPCertificate))
		if block == nil {
			return nil, fmt.Errorf("failed to decode IdP certificate PEM")
		}
		var err error
		idpCert, err = x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse IdP certificate: %w", err)
		}
	}

	// Parse SP certificate and private key (if provided)
	var spCert *x509.Certificate
	var spKey *rsa.PrivateKey
	if cfg.SPCertificate != "" && cfg.SPPrivateKey != "" {
		block, _ := pem.Decode([]byte(cfg.SPCertificate))
		if block == nil {
			return nil, fmt.Errorf("failed to decode SP certificate PEM")
		}
		var err error
		spCert, err = x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("parse SP certificate: %w", err)
		}

		keyBlock, _ := pem.Decode([]byte(cfg.SPPrivateKey))
		if keyBlock == nil {
			return nil, fmt.Errorf("failed to decode SP private key PEM")
		}
		spKey, err = x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
		if err != nil {
			// Try PKCS8 format
			key, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
			if err != nil {
				return nil, fmt.Errorf("parse SP private key: %w", err)
			}
			var ok bool
			spKey, ok = key.(*rsa.PrivateKey)
			if !ok {
				return nil, fmt.Errorf("SP private key is not an RSA key")
			}
		}
	}

	// Determine NameID format
	nameIDFormat := saml.UnspecifiedNameIDFormat
	if cfg.NameIDFormat != "" {
		if format, ok := nameIDFormatMapping[cfg.NameIDFormat]; ok {
			nameIDFormat = format
		}
	}

	return &SAMLProvider{
		idpEntityID:      cfg.IDPEntityID,
		idpSSOURL:        cfg.IDPSSOURL,
		idpCertificate:   idpCert,
		spEntityID:       cfg.SPEntityID,
		spACSURL:         cfg.SPACSURL,
		spCertificate:    spCert,
		spPrivateKey:     spKey,
		nameIDFormat:     nameIDFormat,
		attributeMapping: cfg.AttributeMapping,
	}, nil
}

// boolPtr returns a pointer to a bool value.
func boolPtr(b bool) *bool { return &b }

// AuthURL constructs a SAML AuthnRequest redirect URL.
// The state parameter is passed as RelayState.
func (p *SAMLProvider) AuthURL(state, _ string) string {
	nameIDFormat := string(p.nameIDFormat)
	req := saml.AuthnRequest{
		AssertionConsumerServiceURL: p.spACSURL,
		Destination:                 p.idpSSOURL,
		IssueInstant:                saml.TimeNow(),
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

	// SAML HTTP-Redirect binding requires DEFLATE compression before base64 encoding
	var compressed bytes.Buffer
	writer, _ := flate.NewWriter(&compressed, flate.DefaultCompression)
	_, _ = writer.Write(reqBuf)
	_ = writer.Close()

	encoded := base64.StdEncoding.EncodeToString(compressed.Bytes())

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

			// Use configured attribute mapping if provided
			if p.attributeMapping != nil {
				if field, ok := p.attributeMapping[attr.Name]; ok {
					switch field {
					case "username":
						info.Username = val
					case "email":
						info.Email = val
					case "name":
						info.Name = val
					}
					continue
				}
			}

			// Default attribute mapping (standard LDAP OID + friendly names)
			// Reference: https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/plan/attributes
			// Reference: https://wiki.internet2.edu/display/InCFederation/EduPerson+Object+Class+Spec
			switch attr.Name {
			// username: uid (RFC 4514), userID (deprecated)
			case "username", "uid", "urn:oid:0.9.2342.19200300.100.1.1":
				info.Username = val
			// email: mail (RFC 4524), eduPersonPrincipalName (Internet2 EduPerson)
			case "email", "mail", "urn:oid:0.9.2342.19200300.100.1.3", "urn:oid:1.3.6.1.4.1.5923.1.1.1.6":
				info.Email = val
			// name: displayName (RFC 2798), cn (commonName)
			case "name", "displayName", "urn:oid:2.16.840.1.113730.3.1.241", "urn:oid:2.5.4.3":
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
	descriptor := &saml.EntityDescriptor{
		EntityID: p.spEntityID,
		SPSSODescriptors: []saml.SPSSODescriptor{
			{
				SSODescriptor: saml.SSODescriptor{
					RoleDescriptor: saml.RoleDescriptor{
						ProtocolSupportEnumeration: "urn:oasis:names:tc:SAML:2.0:protocol",
					},
					NameIDFormats: []saml.NameIDFormat{
						p.nameIDFormat,
					},
				},
				AuthnRequestsSigned:  boolPtr(p.spPrivateKey != nil),
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

	// If SP certificate is configured, add it to KeyDescriptor
	if p.spCertificate != nil {
		certData := base64.StdEncoding.EncodeToString(p.spCertificate.Raw)
		descriptor.SPSSODescriptors[0].KeyDescriptors = []saml.KeyDescriptor{
			{
				Use: "signing",
				KeyInfo: saml.KeyInfo{
					X509Data: saml.X509Data{
						X509Certificates: []saml.X509Certificate{
							{Data: strings.TrimSpace(certData)},
						},
					},
				},
			},
		}
	}

	return descriptor
}
