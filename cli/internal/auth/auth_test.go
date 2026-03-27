package auth

import (
	"os"
	"path/filepath"
	"testing"
)

func TestManagerLoadRestoresCookieDomainAndPath(t *testing.T) {
	dir := t.TempDir()
	jarPath := filepath.Join(dir, "cookies.json")

	session := `{
  "cookies": [
    {
      "Name": "NIUBILITY",
      "Value": "token",
      "Path": "",
      "Domain": ""
    }
  ],
  "server": "http://example.com:9000"
}`

	if err := os.WriteFile(jarPath, []byte(session), 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	mgr, err := NewManager(jarPath, "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	if !mgr.HasSession() {
		t.Fatal("HasSession() = false, want true")
	}
}

func TestManagerLoadNormalizesStoredServerURL(t *testing.T) {
	dir := t.TempDir()
	jarPath := filepath.Join(dir, "cookies.json")

	session := `{
  "cookies": [
    {
      "Name": "NIUBILITY",
      "Value": "token",
      "Path": "",
      "Domain": ""
    }
  ],
  "server": "http://example.com:9000/"
}`

	if err := os.WriteFile(jarPath, []byte(session), 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	mgr, err := NewManager(jarPath, "http://example.com:9000")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}

	if !mgr.HasSession() {
		t.Fatal("HasSession() = false, want true")
	}
}
