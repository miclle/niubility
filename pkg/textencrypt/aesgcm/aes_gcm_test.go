package aesgcm

import (
	"bytes"
	"crypto/rand"
	"io"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	// Generate a valid 32-byte key
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	tests := []struct {
		name      string
		plaintext []byte
	}{
		{"empty", []byte{}},
		{"single byte", []byte{0x42}},
		{"short text", []byte("hello world")},
		{"long text", []byte("This is a longer piece of text that should be encrypted and decrypted correctly")},
		{"binary data", []byte{0x00, 0x01, 0x02, 0x03, 0xFF, 0xFE, 0xFD}},
		{"unicode", []byte("你好世界 🌍")},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ciphertext, err := Encrypt(key, tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt() error = %v", err)
			}

			// Ciphertext should be different from plaintext
			if bytes.Equal(ciphertext, tt.plaintext) {
				t.Error("Ciphertext should not equal plaintext")
			}

			// Ciphertext should be longer (includes nonce + auth tag)
			if len(ciphertext) <= len(tt.plaintext) {
				t.Errorf("Ciphertext length %d should be > plaintext length %d", len(ciphertext), len(tt.plaintext))
			}

			decrypted, err := Decrypt(key, ciphertext)
			if err != nil {
				t.Fatalf("Decrypt() error = %v", err)
			}

			if !bytes.Equal(decrypted, tt.plaintext) {
				t.Errorf("Decrypt() = %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestEncrypt_InvalidKeySize(t *testing.T) {
	tests := []struct {
		name string
		key  []byte
	}{
		{"empty key", []byte{}},
		{"16-byte key", make([]byte, 16)},
		{"24-byte key", make([]byte, 24)},
		{"31-byte key", make([]byte, 31)},
		{"33-byte key", make([]byte, 33)},
		{"64-byte key", make([]byte, 64)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Encrypt(tt.key, []byte("test"))
			if err == nil {
				t.Error("Encrypt() expected error for invalid key size, got nil")
			}
		})
	}
}

func TestDecrypt_InvalidKeySize(t *testing.T) {
	tests := []struct {
		name string
		key  []byte
	}{
		{"empty key", []byte{}},
		{"16-byte key", make([]byte, 16)},
		{"24-byte key", make([]byte, 24)},
		{"31-byte key", make([]byte, 31)},
		{"33-byte key", make([]byte, 33)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Decrypt(tt.key, []byte("sometext"))
			if err == nil {
				t.Error("Decrypt() expected error for invalid key size, got nil")
			}
		})
	}
}

func TestDecrypt_CiphertextTooShort(t *testing.T) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	tests := []struct {
		name string
		data []byte
	}{
		{"empty", []byte{}},
		{"1 byte", []byte{0x00}},
		{"11 bytes", make([]byte, 11)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Decrypt(key, tt.data)
			if err == nil {
				t.Error("Decrypt() expected error for short ciphertext, got nil")
			}
		})
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key1); err != nil {
		t.Fatalf("Failed to generate key1: %v", err)
	}
	if _, err := io.ReadFull(rand.Reader, key2); err != nil {
		t.Fatalf("Failed to generate key2: %v", err)
	}

	plaintext := []byte("secret message")
	ciphertext, err := Encrypt(key1, plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	_, err = Decrypt(key2, ciphertext)
	if err == nil {
		t.Error("Decrypt() expected error for wrong key, got nil")
	}
}

func TestEncrypt_DifferentCiphertexts(t *testing.T) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	plaintext := []byte("same message")

	ciphertext1, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	ciphertext2, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	// Same plaintext should produce different ciphertexts (due to random nonce)
	if bytes.Equal(ciphertext1, ciphertext2) {
		t.Error("Same plaintext should produce different ciphertexts")
	}

	// But both should decrypt to the same plaintext
	decrypted1, err := Decrypt(key, ciphertext1)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}

	decrypted2, err := Decrypt(key, ciphertext2)
	if err != nil {
		t.Fatalf("Decrypt() error = %v", err)
	}

	if !bytes.Equal(decrypted1, plaintext) {
		t.Error("Decrypted text 1 doesn't match plaintext")
	}
	if !bytes.Equal(decrypted2, plaintext) {
		t.Error("Decrypted text 2 doesn't match plaintext")
	}
}

func TestDecrypt_TamperedCiphertext(t *testing.T) {
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		t.Fatalf("Failed to generate key: %v", err)
	}

	plaintext := []byte("secret message")
	ciphertext, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt() error = %v", err)
	}

	// Tamper with the ciphertext
	if len(ciphertext) > 0 {
		ciphertext[0] ^= 0xFF
	}

	_, err = Decrypt(key, ciphertext)
	if err == nil {
		t.Error("Decrypt() expected error for tampered ciphertext, got nil")
	}
}
