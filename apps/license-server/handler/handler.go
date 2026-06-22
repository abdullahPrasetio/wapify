package handler

import (
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-license-server/db"
	"github.com/waluyo/wapbolt-license-server/keygen"
	"github.com/waluyo/wapbolt-license-server/mailer"
	"github.com/waluyo/wapbolt-license-server/model"
)

// RequireAdminKey protects admin endpoints.
// The caller must send header `X-Admin-Key: <ADMIN_API_KEY>`.
func RequireAdminKey(c *fiber.Ctx) error {
	expected := os.Getenv("ADMIN_API_KEY")
	if expected == "" {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Admin API key not configured on server",
		})
	}
	if c.Get("X-Admin-Key") != expected {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return c.Next()
}

// SubmitRequest is the public endpoint called from the landing page.
// It generates an Ed25519 license key immediately and emails it to the requester.
func SubmitRequest(c *fiber.Ctx) error {
	var body struct {
		Name    string `json:"name"`
		Email   string `json:"email"`
		Message string `json:"message"`
	}
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.TrimSpace(body.Email)
	body.Message = strings.TrimSpace(body.Message)

	if body.Name == "" || body.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name and email are required"})
	}
	if !strings.Contains(body.Email, "@") || !strings.Contains(body.Email, ".") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid email address"})
	}

	// Cek apakah email sudah pernah request license sebelumnya.
	var existing model.LicenseRequest
	if err := db.DB.Where("email = ? AND status = ?", body.Email, "approved").First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Email ini sudah memiliki license aktif. Cek inbox Anda.",
		})
	}

	// Generate the Ed25519 license key.
	licenseKey, validUntil, err := keygen.Generate(body.Name, body.Email, "")
	if err != nil {
		log.Error().Err(err).Msg("License key generation failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate license key. Please contact the administrator.",
		})
	}

	// Persist the issued license.
	duration := os.Getenv("LICENSE_DURATION")
	if duration == "" {
		duration = "1year"
	}
	req := model.LicenseRequest{
		Name:       body.Name,
		Email:      body.Email,
		Message:    body.Message,
		Status:     "approved",
		Duration:   duration,
		ValidUntil: validUntil,
		LicenseKey: licenseKey,
	}
	if err := db.DB.Create(&req).Error; err != nil {
		log.Error().Err(err).Msg("Failed to save license request")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save license record"})
	}

	log.Info().Uint("id", req.ID).Str("email", req.Email).Time("valid_until", validUntil).Msg("License issued")

	// Deliver key to user and copy admin — both fire-and-forget.
	go func() {
		if err := mailer.DeliverLicenseKey(req.Email, req.Name, licenseKey, validUntil); err != nil {
			log.Error().Err(err).Msg("Email delivery failed — license key logged below")
			log.Info().Str("license_key", licenseKey).Str("email", req.Email).Msg("Undelivered license key")
		}
	}()
	go mailer.NotifyAdmin(req.Name, req.Email, licenseKey, validUntil, req.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     "License key generated and sent to your email!",
		"valid_until": validUntil.Format(time.RFC3339),
	})
}

// ListRequests returns all issued licenses (admin only).
func ListRequests(c *fiber.Ctx) error {
	q := db.DB.Model(&model.LicenseRequest{}).Order("created_at DESC")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	var items []model.LicenseRequest
	if err := q.Find(&items).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch records"})
	}
	return c.JSON(fiber.Map{"data": items, "total": len(items)})
}

// RevokeRequest marks a license as revoked (admin only).
func RevokeRequest(c *fiber.Ctx) error {
	id := c.Params("id")
	updates := map[string]any{"status": "revoked", "updated_at": time.Now()}
	if err := db.DB.Model(&model.LicenseRequest{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to revoke license"})
	}
	return c.JSON(fiber.Map{"message": "License revoked"})
}

// DeleteRequest removes a license record (admin only).
func DeleteRequest(c *fiber.Ctx) error {
	if err := db.DB.Delete(&model.LicenseRequest{}, c.Params("id")).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete record"})
	}
	return c.JSON(fiber.Map{"message": "Deleted"})
}
