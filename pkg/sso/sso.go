// Package sso provides SSO authentication service integration.
package sso

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"errors"
	"strings"
)

var (
	// ErrBlockSize indicates the decoded message length is not a multiple of block size.
	ErrBlockSize = errors.New("blocksize must be multiple of decoded message length")
	// ErrUnpad indicates an unpadding error, possibly due to incorrect encryption key.
	ErrUnpad = errors.New("unpad error. This could happen when incorrect encryption key is used")
	// ErrTokenEmpty indicates the token is empty.
	ErrTokenEmpty = errors.New("token cannot be empty")
)

// AESDecrypt decrypts an AES-CFB encrypted token.
func AESDecrypt(key []byte, text string) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	decodedMsg, err := base64.URLEncoding.DecodeString(addBase64Padding(text))
	if err != nil {
		return "", err
	}

	if len(decodedMsg) == 0 {
		return "", ErrBlockSize
	}

	if (len(decodedMsg) % aes.BlockSize) != 0 {
		return "", ErrBlockSize
	}

	iv := decodedMsg[:aes.BlockSize]
	msg := decodedMsg[aes.BlockSize:]

	//lint:ignore SA1019 CFB is required by the SSO provider; migration not feasible
	cfb := cipher.NewCFBDecrypter(block, iv) //nolint:staticcheck
	cfb.XORKeyStream(msg, msg)

	unpadMsg, err := unpad(msg)
	if err != nil {
		return "", err
	}

	return string(unpadMsg), nil
}

func addBase64Padding(value string) string {
	m := len(value) % 4
	if m != 0 {
		value += strings.Repeat("=", 4-m)
	}
	return value
}

func unpad(src []byte) ([]byte, error) {
	length := len(src)
	if length == 0 {
		return nil, ErrUnpad
	}

	unpadding := int(src[length-1])

	if unpadding > length {
		return nil, ErrUnpad
	}

	return src[:(length - unpadding)], nil
}
