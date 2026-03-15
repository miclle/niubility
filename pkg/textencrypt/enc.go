// Package textencrypt provides text encryption and decryption utilities.
// It uses AES-256-GCM for secure encryption with authentication.
package textencrypt

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"

	"github.com/miclle/niubility/pkg/textencrypt/aesgcm"
)

const (
	// versionV1 is the encryption version byte for AES-256-GCM.
	versionV1 byte = 1
	// Prefix marks the start of an encrypted value.
	Prefix = "ENC["
	// Suffix marks the end of an encrypted value.
	Suffix = "]"
)

// Encryptor provides encryption and decryption capabilities.
type Encryptor struct {
	key [32]byte
}

// NewEncryptor creates a new Encryptor with the given 32-byte hex-encoded key.
func NewEncryptor(hexKey string) (*Encryptor, error) {
	keyBytes, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("decode hex key: %w", err)
	}
	if len(keyBytes) != 32 {
		return nil, fmt.Errorf("key must be 32 bytes (64 hex chars), got %d bytes", len(keyBytes))
	}

	e := &Encryptor{}
	copy(e.key[:], keyBytes)
	return e, nil
}

// GenerateKey generates a new random 32-byte key and returns it as hex string.
func GenerateKey() (string, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return "", fmt.Errorf("generate key: %w", err)
	}
	return hex.EncodeToString(key), nil
}

// Encrypt encrypts plaintext and returns a prefixed base64-encoded string.
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	ciphertext, err := aesgcm.Encrypt(e.key[:], []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("encrypt: %w", err)
	}

	// Prepend version byte
	buf := make([]byte, len(ciphertext)+1)
	buf[0] = versionV1
	copy(buf[1:], ciphertext)

	return Prefix + base64.StdEncoding.EncodeToString(buf) + Suffix, nil
}

// Decrypt decrypts a prefixed base64-encoded ciphertext string.
// If the input is not encrypted (no prefix/suffix), it returns the input unchanged.
func (e *Encryptor) Decrypt(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", nil
	}

	// Check if the value is encrypted
	if len(ciphertext) < len(Prefix)+len(Suffix) {
		return ciphertext, nil
	}
	if ciphertext[:len(Prefix)] != Prefix || ciphertext[len(ciphertext)-len(Suffix):] != Suffix {
		return ciphertext, nil
	}

	// Remove prefix and suffix
	encoded := ciphertext[len(Prefix) : len(ciphertext)-len(Suffix)]

	buf, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode base64: %w", err)
	}

	if len(buf) < 1 {
		return "", fmt.Errorf("empty encrypted data")
	}

	// Check version
	ver := buf[0]
	if ver != versionV1 {
		return "", fmt.Errorf("unsupported encryption version: %d", ver)
	}

	plaintext, err := aesgcm.Decrypt(e.key[:], buf[1:])
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}

	return string(plaintext), nil
}

// IsEncrypted checks if a string is encrypted (has ENC[...] format).
func IsEncrypted(s string) bool {
	if len(s) < len(Prefix)+len(Suffix) {
		return false
	}
	return s[:len(Prefix)] == Prefix && s[len(s)-len(Suffix):] == Suffix
}
