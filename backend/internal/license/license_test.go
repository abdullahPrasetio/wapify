package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestVerifyLicense(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(nil)
	pubBase64 := base64.StdEncoding.EncodeToString(pub)

	t.Run("Valid License", func(t *testing.T) {
		payload := LicensePayload{
			ClientName: "Test Client",
			Email:      "test@test.com",
			ValidUntil: time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		
		signature := ed25519.Sign(priv, payloadJSON)
		sigBase64 := base64.StdEncoding.EncodeToString(signature)
		
		licenseKey := payloadBase64 + "." + sigBase64
		
		verified, err := VerifyLicense(licenseKey, pubBase64)
		assert.NoError(t, err)
		assert.Equal(t, payload.ClientName, verified.ClientName)
	})

	t.Run("Grace Period License", func(t *testing.T) {
		payload := LicensePayload{
			ClientName: "Test Client",
			Email:      "test@test.com",
			ValidUntil: time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		
		signature := ed25519.Sign(priv, payloadJSON)
		sigBase64 := base64.StdEncoding.EncodeToString(signature)
		
		licenseKey := payloadBase64 + "." + sigBase64
		
		verified, err := VerifyLicense(licenseKey, pubBase64)
		assert.NoError(t, err)
		assert.Equal(t, payload.ClientName, verified.ClientName)
	})

	t.Run("Expired License Beyond Grace", func(t *testing.T) {
		payload := LicensePayload{
			ClientName: "Test Client",
			Email:      "test@test.com",
			ValidUntil: time.Now().Add(-48 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		
		signature := ed25519.Sign(priv, payloadJSON)
		sigBase64 := base64.StdEncoding.EncodeToString(signature)
		
		licenseKey := payloadBase64 + "." + sigBase64
		
		_, err := VerifyLicense(licenseKey, pubBase64)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "expired")
	})

	t.Run("Invalid Key Format", func(t *testing.T) {
		_, err := VerifyLicense("invalidkey", pubBase64)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid license key format")
	})

	t.Run("Invalid Public Key Base64", func(t *testing.T) {
		_, err := VerifyLicense("p.s", "invalid!")
		assert.Error(t, err)
	})

	t.Run("Invalid Payload Base64", func(t *testing.T) {
		_, err := VerifyLicense("invalid!.s", pubBase64)
		assert.Error(t, err)
	})

	t.Run("Invalid Payload JSON", func(t *testing.T) {
		payloadBase64 := base64.StdEncoding.EncodeToString([]byte("{invalid json}"))
		_, err := VerifyLicense(payloadBase64+".sig", pubBase64)
		assert.Error(t, err)
	})

	t.Run("Invalid Signature Base64", func(t *testing.T) {
		payloadJSON, _ := json.Marshal(LicensePayload{})
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		_, err := VerifyLicense(payloadBase64+".invalid!", pubBase64)
		assert.Error(t, err)
	})

	t.Run("Signature Verification Failure", func(t *testing.T) {
		payloadJSON, _ := json.Marshal(LicensePayload{})
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		sigBase64 := base64.StdEncoding.EncodeToString(make([]byte, 64))
		_, err := VerifyLicense(payloadBase64+"."+sigBase64, pubBase64)
		assert.Error(t, err)
	})

	t.Run("Invalid Expiry Date Format", func(t *testing.T) {
		payload := LicensePayload{
			ValidUntil: "2024-01-01", // Not RFC3339
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		
		signature := ed25519.Sign(priv, payloadJSON)
		sigBase64 := base64.StdEncoding.EncodeToString(signature)
		
		_, err := VerifyLicense(payloadBase64+"."+sigBase64, pubBase64)
		assert.Error(t, err)
	})
}

func TestSplitLicenseKey(t *testing.T) {
	t.Run("No Dot", func(t *testing.T) {
		parts := splitLicenseKey("abc")
		assert.Len(t, parts, 1)
		assert.Equal(t, "abc", parts[0])
	})

	t.Run("Multiple Dots", func(t *testing.T) {
		parts := splitLicenseKey("a.b.c")
		assert.Len(t, parts, 2)
		assert.Equal(t, "a.b", parts[0])
		assert.Equal(t, "c", parts[1])
	})
}
