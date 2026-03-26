package entity

import (
	"testing"
)

func TestSetting_TableName(t *testing.T) {
	s := Setting{}
	if got := s.TableName(); got != "settings" {
		t.Errorf("TableName() = %q, want %q", got, "settings")
	}
}

func TestSetting_Constants(t *testing.T) {
	// Test JWT and encryption keys
	if SettingJWTSecret != "jwt_secret" {
		t.Errorf("SettingJWTSecret = %q, want %q", SettingJWTSecret, "jwt_secret")
	}
	if SettingEncryptionKey != "encryption_key" {
		t.Errorf("SettingEncryptionKey = %q, want %q", SettingEncryptionKey, "encryption_key")
	}

	// Test SSO type constants
	if SettingSSOType != "sso_type" {
		t.Errorf("SettingSSOType = %q, want %q", SettingSSOType, "sso_type")
	}

	// Test OIDC settings
	if SettingSSOOIDCIssuer != "sso_oidc_issuer" {
		t.Errorf("SettingSSOOIDCIssuer = %q, want %q", SettingSSOOIDCIssuer, "sso_oidc_issuer")
	}
	if SettingSSOOIDCClientID != "sso_oidc_client_id" {
		t.Errorf("SettingSSOOIDCClientID = %q, want %q", SettingSSOOIDCClientID, "sso_oidc_client_id")
	}
	if SettingSSOOIDCClientSecret != "sso_oidc_client_secret" {
		t.Errorf("SettingSSOOIDCClientSecret = %q, want %q", SettingSSOOIDCClientSecret, "sso_oidc_client_secret")
	}

	// Test SAML settings
	if SettingSSOSAMLIDPMetadataURL != "sso_saml_idp_metadata_url" {
		t.Errorf("SettingSSOSAMLIDPMetadataURL = %q, want %q", SettingSSOSAMLIDPMetadataURL, "sso_saml_idp_metadata_url")
	}

	// Test WeChat settings
	if SettingWechatCorpID != "wechat.corp_id" {
		t.Errorf("SettingWechatCorpID = %q, want %q", SettingWechatCorpID, "wechat.corp_id")
	}

	// Test S3 settings
	if SettingS3Endpoint != "s3.endpoint" {
		t.Errorf("SettingS3Endpoint = %q, want %q", SettingS3Endpoint, "s3.endpoint")
	}
	if SettingS3Bucket != "s3.bucket" {
		t.Errorf("SettingS3Bucket = %q, want %q", SettingS3Bucket, "s3.bucket")
	}
}
