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

	t.Run("Expired License", func(t *testing.T) {
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

	t.Run("Invalid Signature", func(t *testing.T) {
		payload := LicensePayload{
			ClientName: "Test Client",
			Email:      "test@test.com",
			ValidUntil: time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadBase64 := base64.StdEncoding.EncodeToString(payloadJSON)
		
		licenseKey := payloadBase64 + ".invalid-signature"
		
		_, err := VerifyLicense(licenseKey, pubBase64)
		assert.Error(t, err)
	})
}
