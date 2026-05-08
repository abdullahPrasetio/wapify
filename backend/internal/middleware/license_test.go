package middleware

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/license"
)

func TestCheckLicense(t *testing.T) {
	app := fiber.New()
	pub, priv, _ := ed25519.GenerateKey(nil)
	pubBase64 := base64.StdEncoding.EncodeToString(pub)

	handler := CheckLicense(pubBase64)
	app.Get("/protected", handler, func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	t.Run("Skip when Private Key exists (Central Mode)", func(t *testing.T) {
		os.Setenv("LICENSE_PRIVATE_KEY", "any-key")
		defer os.Unsetenv("LICENSE_PRIVATE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Skip when No Public Key (Dev Mode)", func(t *testing.T) {
		devApp := fiber.New()
		devApp.Get("/test", CheckLicense(""), func(c *fiber.Ctx) error { return c.SendStatus(200) })
		
		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := devApp.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Skip Auth paths", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/auth/login", nil)
		app.Get("/api/v1/auth/login", handler, func(c *fiber.Ctx) error { return c.SendStatus(200) })
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Skip Root path", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		app.Get("/", handler, func(c *fiber.Ctx) error { return c.SendStatus(200) })
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Fail when License Key missing", func(t *testing.T) {
		os.Setenv("LICENSE_KEY", "")
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusPaymentRequired, resp.StatusCode)
	})

	t.Run("Fail when License Invalid", func(t *testing.T) {
		os.Setenv("LICENSE_KEY", "invalid.key")
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Success with Valid License", func(t *testing.T) {
		payload := license.LicensePayload{
			ClientName: "Test",
			ValidUntil: time.Now().Add(100 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadB64 := base64.StdEncoding.EncodeToString(payloadJSON)
		sig := ed25519.Sign(priv, payloadJSON)
		sigB64 := base64.StdEncoding.EncodeToString(sig)
		
		os.Setenv("LICENSE_KEY", payloadB64+"."+sigB64)
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Grace Period Warning", func(t *testing.T) {
		payload := license.LicensePayload{
			ClientName: "Test",
			ValidUntil: time.Now().Add(-1 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadB64 := base64.StdEncoding.EncodeToString(payloadJSON)
		sig := ed25519.Sign(priv, payloadJSON)
		sigB64 := base64.StdEncoding.EncodeToString(sig)
		
		os.Setenv("LICENSE_KEY", payloadB64+"."+sigB64)
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Contains(t, resp.Header.Get("X-Wapbolt-License-Warning"), "Grace Period")
	})

	t.Run("Warning Nearing Expiry (Days)", func(t *testing.T) {
		payload := license.LicensePayload{
			ClientName: "Test",
			ValidUntil: time.Now().Add(48 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadB64 := base64.StdEncoding.EncodeToString(payloadJSON)
		sig := ed25519.Sign(priv, payloadJSON)
		sigB64 := base64.StdEncoding.EncodeToString(sig)
		
		os.Setenv("LICENSE_KEY", payloadB64+"."+sigB64)
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Contains(t, resp.Header.Get("X-Wapbolt-License-Warning"), "expire in 1 days")
	})

	t.Run("Warning Nearing Expiry (Hours)", func(t *testing.T) {
		payload := license.LicensePayload{
			ClientName: "Test",
			ValidUntil: time.Now().Add(5 * time.Hour).Format(time.RFC3339),
		}
		payloadJSON, _ := json.Marshal(payload)
		payloadB64 := base64.StdEncoding.EncodeToString(payloadJSON)
		sig := ed25519.Sign(priv, payloadJSON)
		sigB64 := base64.StdEncoding.EncodeToString(sig)
		
		os.Setenv("LICENSE_KEY", payloadB64+"."+sigB64)
		defer os.Unsetenv("LICENSE_KEY")

		req := httptest.NewRequest("GET", "/protected", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Contains(t, resp.Header.Get("X-Wapbolt-License-Warning"), "expire in")
		assert.Contains(t, resp.Header.Get("X-Wapbolt-License-Warning"), "hours")
	})
}
