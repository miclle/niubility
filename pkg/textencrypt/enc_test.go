package textencrypt

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/miclle/niubility/pkg/textencrypt/aesgcm"
)

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
