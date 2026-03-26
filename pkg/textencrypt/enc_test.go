package textencrypt

import (
	"encoding/base64"
	"flag"
	"os"
	"strings"
	"testing"

	"github.com/miclle/niubility/pkg/textencrypt/aesgcm"
)

// Command line flag for specifying plaintext to encrypt
var plaintextFlag = flag.String("plaintext", "", "plaintext string to encrypt")

// getPlaintext returns the plaintext from flag, environment variable, or default value.
// Priority: -plaintext flag > PLAINTEXT env var > default value
func getPlaintext(defaultValue string) string {
	if *plaintextFlag != "" {
		return *plaintextFlag
	}
	if env := os.Getenv("PLAINTEXT"); env != "" {
		return env
	}
	return defaultValue
}

func TestAutoDecrypt(t *testing.T) {
	// First encrypt some test values
	text1 := "plain"
	encrypted1, err := encrypt(text1)
	if err != nil {
		t.Fatalf("encrypt %q failed: %v", text1, err)
	}

	text2 := "another-text"
	encrypted2, err := encrypt(text2)
	if err != nil {
		t.Fatalf("encrypt %q failed: %v", text2, err)
	}

	tests := []struct {
		name      string
		input     string
		want      string
		wantError bool
	}{
		{
			name:  "Empty string",
			input: "",
			want:  "",
		},
		{
			name:  "Plain text without encryption",
			input: "abc",
			want:  "abc",
		},
		{
			name:  "Single encrypted value",
			input: encrypted1,
			want:  text1,
		},
		{
			name:  "Encrypted with prefix",
			input: "prefix-" + encrypted1,
			want:  "prefix-" + text1,
		},
		{
			name:  "Encrypted with suffix",
			input: encrypted1 + "-suffix",
			want:  text1 + "-suffix",
		},
		{
			name:  "Encrypted with prefix and suffix",
			input: "prefix-" + encrypted1 + "-suffix",
			want:  "prefix-" + text1 + "-suffix",
		},
		{
			name:  "Two encrypted values",
			input: encrypted1 + encrypted2,
			want:  text1 + text2,
		},
		{
			name:  "Complex mix",
			input: "prefix-" + encrypted1 + "-middle-" + encrypted2 + "-suffix",
			want:  "prefix-" + text1 + "-middle-" + text2 + "-suffix",
		},
		{
			name:  "Repeated encrypted",
			input: strings.Repeat(encrypted1, 3),
			want:  strings.Repeat(text1, 3),
		},
		{
			name:  "Incomplete block",
			input: encrypted1 + Prefix + "abc",
			want:  text1 + Prefix + "abc",
		},
		{
			name:      "Invalid base64",
			input:     Prefix + "invalid-base64-!!" + Suffix,
			want:      Prefix + "invalid-base64-!!" + Suffix, // on error, returns original string
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := AutoDecrypt(tt.input)
			if (err != nil) != tt.wantError {
				t.Errorf("AutoDecrypt() error = %v, wantError %v", err, tt.wantError)
				return
			}
			if got != tt.want {
				t.Errorf("AutoDecrypt() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestAutoDecryptNoMatch(t *testing.T) {
	input := "no encryption here"
	got, err := AutoDecrypt(input)
	if err != nil {
		t.Fatalf("AutoDecrypt() error = %v", err)
	}
	if got != input {
		t.Errorf("AutoDecrypt() = %q, want %q", got, input)
	}
}

// encrypt is a helper function that uses the defaultKey to encrypt plaintext
func encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}
	ciphertext, err := aesgcm.Encrypt(defaultKey[:], []byte(plaintext))
	if err != nil {
		return "", err
	}
	buf := make([]byte, len(ciphertext)+1)
	buf[0] = versionV1
	copy(buf[1:], ciphertext)
	return Prefix + base64.StdEncoding.EncodeToString(buf) + Suffix, nil
}

// TestEncryptString is a helper test to generate encrypted strings.
//
// Usage:
//
//	# Use default value
//	go test -run TestEncryptString -v
//
//	# Use flag (recommended)
//	go test -run TestEncryptString -args -plaintext="your-secret" -v
//
//	# Use environment variable
//	PLAINTEXT="your-secret" go test -run TestEncryptString -v
func TestEncryptString(t *testing.T) {
	plaintext := getPlaintext("postgres")

	encrypted, err := encrypt(plaintext)
	if err != nil {
		t.Fatalf("encrypt %q failed: %v", plaintext, err)
	}

	t.Logf("Plaintext:  %q", plaintext)
	t.Logf("Encrypted:  %s", encrypted)

	// Verify round-trip
	decrypted, err := AutoDecrypt(encrypted)
	if err != nil {
		t.Fatalf("AutoDecrypt failed: %v", err)
	}
	if decrypted != plaintext {
		t.Errorf("round-trip failed: got %q, want %q", decrypted, plaintext)
	}

	t.Logf("Decrypted:  %q (verified)", decrypted)
}
