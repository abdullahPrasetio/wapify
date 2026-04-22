package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

type LicensePayload struct {
	ClientName string `json:"client_name"`
	Email      string `json:"email"`
	ValidUntil string `json:"valid_until"` // RFC3339
}

// VerifyLicense decodes and verifies an Ed25519 signed license key.
func VerifyLicense(licenseKey string, publicKeyBase64 string) (*LicensePayload, error) {
	parts := splitLicenseKey(licenseKey)
	if len(parts) != 2 {
		return nil, errors.New("invalid license key format")
	}

	payloadJSONBase64 := parts[0]
	signatureBase64 := parts[1]

	payloadJSON, err := base64.StdEncoding.DecodeString(payloadJSONBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}

	signature, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode signature: %w", err)
	}

	publicKeyBytes, err := base64.StdEncoding.DecodeString(publicKeyBase64)
	if err != nil || len(publicKeyBytes) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key configuration: %w", err)
	}
	publicKey := ed25519.PublicKey(publicKeyBytes)

	if !ed25519.Verify(publicKey, payloadJSON, signature) {
		return nil, errors.New("license signature verification failed")
	}

	var payload LicensePayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal license payload: %w", err)
	}

	validUntil, err := time.Parse(time.RFC3339, payload.ValidUntil)
	if err != nil {
		return nil, fmt.Errorf("failed to parse valid_until date: %w", err)
	}

	// Grace Period: 24 Jam
	gracePeriod := 24 * time.Hour
	if time.Now().After(validUntil.Add(gracePeriod)) {
		return nil, errors.New("license has expired (including 24h grace period)")
	}

	return &payload, nil
}

func splitLicenseKey(licenseKey string) []string {
	for i := len(licenseKey) - 1; i >= 0; i-- {
		if licenseKey[i] == '.' {
			return []string{licenseKey[:i], licenseKey[i+1:]}
		}
	}
	return []string{licenseKey}
}
