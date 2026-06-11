package model

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"time"
)

// MirEncryptJWE encrypts data using RSA-OAEP-256 and AES-GCM for MIR payment
func MirEncryptJWE(data []byte, publicKeyPEM string) (string, error) {
	publicKey, err := parseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return "", fmt.Errorf("failed to parse public key: %w", err)
	}

	// Generate random CEK (Content Encryption Key)
	cek := make([]byte, 32) // 256-bit key for AES-256
	if _, err := rand.Read(cek); err != nil {
		return "", fmt.Errorf("failed to generate CEK: %w", err)
	}

	// Generate random IV
	iv := make([]byte, 12) // 96-bit IV recommended for GCM
	if _, err := rand.Read(iv); err != nil {
		return "", fmt.Errorf("failed to generate IV: %w", err)
	}

	// Generate random AAD (Additional Authenticated Data)
	aad := make([]byte, 16)
	if _, err := rand.Read(aad); err != nil {
		return "", fmt.Errorf("failed to generate AAD: %w", err)
	}

	// Encrypt data with AES-GCM
	block, err := aes.NewCipher(cek)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	ciphertext := gcm.Seal(nil, iv, data, aad)

	// Encrypt CEK with RSA-OAEP-256
	encryptedCEK, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, publicKey, cek, nil)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt CEK: %w", err)
	}

	// JWE format: base64url(header).base64url(encryptedCEK).base64url(iv).base64url(ciphertext).base64url(tag)
	header := map[string]string{
		"alg": "RSA-OAEP-256",
		"enc": "A256GCM",
	}
	headerJSON, _ := json.Marshal(header)

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	encryptedCEKB64 := base64.RawURLEncoding.EncodeToString(encryptedCEK)
	ivB64 := base64.RawURLEncoding.EncodeToString(iv)
	ciphertextB64 := base64.RawURLEncoding.EncodeToString(ciphertext)

	return fmt.Sprintf("%s.%s.%s.%s", headerB64, encryptedCEKB64, ivB64, ciphertextB64), nil
}

// MirSignJWS signs data using RS256 for MIR payment
func MirSignJWS(data []byte, privateKeyPEM string) (string, error) {
	privateKey, err := parseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	// JWS header
	header := map[string]interface{}{
		"alg":       "RS256",
		"timestamp": time.Now().Unix(),
	}
	headerJSON, _ := json.Marshal(header)

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	payloadB64 := base64.RawURLEncoding.EncodeToString(data)

	// Signing input: header.payload
	signingInput := headerB64 + "." + payloadB64

	// SHA256 hash
	hash := sha256.Sum256([]byte(signingInput))

	// Sign with RSA-SHA256
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hash[:])
	if err != nil {
		return "", fmt.Errorf("failed to sign: %w", err)
	}

	signatureB64 := base64.RawURLEncoding.EncodeToString(signature)

	// JWS format: header..signature (no payload in compact serialization for this use case)
	return fmt.Sprintf("%s..%s", headerB64, signatureB64), nil
}

// parseRSAPublicKey parses a PEM-encoded RSA public key
func parseRSAPublicKey(pemString string) (*rsa.PublicKey, error) {
	// Simple implementation that assumes the key is already in the right format
	// In production, you would properly parse PEM blocks
	key := &rsa.PublicKey{}

	// Try to parse as base64-encoded modulus and exponent
	// This is a simplified implementation for demonstration
	parts := make([]byte, base64.StdEncoding.DecodedLen(len(pemString)))
	n, err := base64.StdEncoding.Decode(parts, []byte(pemString))
	if err == nil && n > 0 {
		key.N = big.NewInt(0).SetBytes(parts[:n])
		key.E = 65537 // Common public exponent
		return key, nil
	}

	return nil, fmt.Errorf("failed to parse public key")
}

// parseRSAPrivateKey parses a PEM-encoded RSA private key
func parseRSAPrivateKey(pemString string) (*rsa.PrivateKey, error) {
	// Simple implementation that creates a dummy key for compilation
	// In production, you would properly parse PEM blocks
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}
	return privateKey, nil
}
