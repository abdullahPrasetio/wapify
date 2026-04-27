package middleware

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/license"
)

// CheckLicense is a middleware that ensures the client has a valid license.
// It only enforces checks if a LicensePublicKey is present (Mode Client).
func CheckLicense(publicKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Jika ada Private Key, berarti ini server Central (STB Anda).
		// Kita tidak perlu cek lisensi di sini karena ini adalah sumbernya.
		if os.Getenv("LICENSE_PRIVATE_KEY") != "" {
			fmt.Println("License Private Key found, skipping license check")
			fmt.Println("License Key:", os.Getenv("LICENSE_PRIVATE_KEY"))
			return c.Next()
		}

		// 2. Jika tidak ada Public Key (binary asli/dev), dan tidak ada Private Key,
		// maka skip pengecekan agar tidak mengunci developer di local.
		if publicKey == "" {
			return c.Next()
		}

		// 3. Sisanya, jika ini binary Client (punya Public Key) namun tidak punya Private Key,
		// maka WAJIB cek lisensi.
		path := c.Path()
		if strings.HasPrefix(path, "/api/v1/auth") ||
			path == "/" {
			return c.Next()
		}

		licenseKey := os.Getenv("LICENSE_KEY")
		if licenseKey == "" {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error": "License key missing. Please configure LICENSE_KEY in your environment.",
				"code":  "LICENSE_REQUIRED",
			})
		}

		// Local mathematical verification (Offline check) menggunakan internal/license
		payload, err := license.VerifyLicense(licenseKey, publicKey)
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid or expired license: " + err.Error(),
				"code":  "INVALID_LICENSE",
			})
		}

		// Check for warnings
		validUntil, _ := time.Parse(time.RFC3339, payload.ValidUntil)
		now := time.Now()

		if now.After(validUntil) {
			// In Grace Period
			hoursLeft := int(24 - now.Sub(validUntil).Hours())
			c.Set("X-Wapbolt-License-Warning", "Grace Period: License expired. You have "+fmt.Sprint(hoursLeft)+" hours of access left.")
		} else if validUntil.Sub(now) < 72*time.Hour {
			// Nearing Expiry (3 days)
			daysLeft := int(validUntil.Sub(now).Hours() / 24)
			if daysLeft > 0 {
				c.Set("X-Wapbolt-License-Warning", "License will expire in "+fmt.Sprint(daysLeft)+" days.")
			} else {
				hoursLeft := int(validUntil.Sub(now).Hours())
				c.Set("X-Wapbolt-License-Warning", "License will expire in "+fmt.Sprint(hoursLeft)+" hours.")
			}
		}

		return c.Next()
	}
}
