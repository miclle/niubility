package textencrypt

import (
	"encoding/base64"
	"encoding/hex"
	"flag"
	"os"
	"strings"
	"testing"

	"github.com/miclle/niubility/pkg/textencrypt/aesgcm"
)

// Command line flag for specifying plaintext to encrypt
var plaintextFlag = flag.String("plaintext", "", "plaintext string to encrypt")

func TestNewEncryptor(t *testing.T) {
	tests := []struct {
		name      string
		hexKey    string
		wantError bool
	}{
		{
			name:   "valid 32-byte key",
			hexKey: strings.Repeat("0", 64), // 64 hex chars = 32 bytes
		},
		{
			name:      "invalid hex",
			hexKey:    "not-valid-hex!!",
			wantError: true,
		},
		{
			name:      "key too short",
			hexKey:    strings.Repeat("0", 32), // 32 hex chars = 16 bytes
			wantError: true,
		},
		{
			name:      "key too long",
			hexKey:    strings.Repeat("0", 128), // 128 hex chars = 64 bytes
			wantError: true,
		},
		{
			name:      "empty key",
			hexKey:    "",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			enc, err := NewEncryptor(tt.hexKey)
			if tt.wantError {
				if err == nil {
					t.Error("NewEncryptor() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("NewEncryptor() error = %v", err)
			}
			if enc == nil {
				t.Error("NewEncryptor() returned nil")
			}
		})
	}
}

func TestGenerateKey(t *testing.T) {
	key1, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	// Key should be 64 hex characters (32 bytes)
	if len(key1) != 64 {
		t.Errorf("GenerateKey() length = %d, want 64", len(key1))
	}

	// Verify it's valid hex
	_, err = hex.DecodeString(key1)
	if err != nil {
		t.Errorf("GenerateKey() returned invalid hex: %v", err)
	}

	// Generate another key and verify they're different
	key2, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	if key1 == key2 {
		t.Error("GenerateKey() returned duplicate keys")
	}
}

func TestEncryptor_EncryptDecrypt(t *testing.T) {
	// Generate a valid key
	key, err := GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	enc, err := NewEncryptor(key)
	if err != nil {
		t.Fatalf("NewEncryptor() error = %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"empty string", ""},
		{"single char", "a"},
		{"short text", "hello world"},
		{"long text", "This is a longer piece of text that should be encrypted and decrypted correctly"},
		{"unicode", "你好世界 🌍"},
		{"special chars", "!@#$%^&*()_+-=[]{}|;':\",./<>?"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ciphertext, err := enc.Encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt() error = %v", err)
			}

			// Empty string should return empty
			if tt.plaintext == "" {
				if ciphertext != "" {
					t.Errorf("Encrypt('') = %q, want empty string", ciphertext)
				}
				return
			}

			// Ciphertext should have prefix and suffix
			if !strings.HasPrefix(ciphertext, Prefix) {
				t.Errorf("Encrypt() missing prefix, got %q", ciphertext)
			}
			if !strings.HasSuffix(ciphertext, Suffix) {
				t.Errorf("Encrypt() missing suffix, got %q", ciphertext)
			}

			// Decrypt should return original plaintext
			decrypted, err := enc.Decrypt(ciphertext)
			if err != nil {
				t.Fatalf("Decrypt() error = %v", err)
			}
			if decrypted != tt.plaintext {
				t.Errorf("Decrypt() = %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestEncryptor_Decrypt_NonEncrypted(t *testing.T) {
	key, _ := GenerateKey()
	enc, _ := NewEncryptor(key)

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"empty string", "", ""},
		{"plain text", "hello world", "hello world"},
		{"short string", "ab", "ab"},
		{"no prefix", "test]", "test]"},
		{"no suffix", "[test", "[test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := enc.Decrypt(tt.input)
			if err != nil {
				t.Fatalf("Decrypt() error = %v", err)
			}
			if got != tt.want {
				t.Errorf("Decrypt() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestEncryptor_Decrypt_Errors(t *testing.T) {
	key, _ := GenerateKey()
	enc, _ := NewEncryptor(key)

	tests := []struct {
		name      string
		input     string
		wantError bool
	}{
		{
			name:      "invalid base64",
			input:     Prefix + "not-valid-base64!!!" + Suffix,
			wantError: true,
		},
		{
			name:      "empty encrypted content",
			input:     Prefix + base64.StdEncoding.EncodeToString([]byte{}) + Suffix,
			wantError: true,
		},
		{
			name:      "wrong version",
			input:     Prefix + base64.StdEncoding.EncodeToString([]byte{2, 1, 2, 3}) + Suffix, // version 2
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := enc.Decrypt(tt.input)
			if tt.wantError {
				if err == nil {
					t.Error("Decrypt() expected error, got nil")
				}
			} else if err != nil {
				t.Errorf("Decrypt() error = %v", err)
			}
		})
	}
}

func TestEncryptor_Encrypt_DifferentCiphertexts(t *testing.T) {
	key, _ := GenerateKey()
	enc, _ := NewEncryptor(key)

	plaintext := "same message"

	ciphertext1, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	ciphertext2, err := enc.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	// Same plaintext should produce different ciphertexts (due to random nonce)
	if ciphertext1 == ciphertext2 {
		t.Error("Same plaintext should produce different ciphertexts")
	}

	// But both should decrypt to the same plaintext
	decrypted1, _ := enc.Decrypt(ciphertext1)
	decrypted2, _ := enc.Decrypt(ciphertext2)

	if decrypted1 != plaintext || decrypted2 != plaintext {
		t.Error("Both ciphertexts should decrypt to original plaintext")
	}
}

func TestIsEncrypted(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"empty string", "", false},
		{"short string", "ab", false},
		{"plain text", "hello world", false},
		{"only prefix", Prefix, false},
		{"only suffix", Suffix, false},
		{"prefix without suffix", Prefix + "content", false},
		{"suffix without prefix", "content" + Suffix, false},
		{"valid encrypted format", Prefix + "content" + Suffix, true},
		{"valid with base64", Prefix + "YWJjMTIz" + Suffix, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsEncrypted(tt.input); got != tt.want {
				t.Errorf("IsEncrypted() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConstants(t *testing.T) {
	if Prefix != "ENC[" {
		t.Errorf("Prefix = %q, want %q", Prefix, "ENC[")
	}
	if Suffix != "]" {
		t.Errorf("Suffix = %q, want %q", Suffix, "]")
	}
	if versionV1 != 1 {
		t.Errorf("versionV1 = %d, want 1", versionV1)
	}
}

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
