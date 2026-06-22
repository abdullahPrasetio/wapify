package handler

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-license-server/db"
	"github.com/waluyo/wapbolt-license-server/model"
)

type ratingPayload struct {
	LicenseEmail string `json:"license_email"`
	UserName     string `json:"user_name"`
	UserEmail    string `json:"user_email"`
	UserCount    int64  `json:"user_count"`
	Rating       int    `json:"rating"`
	Comment      string `json:"comment"`
	Version      string `json:"version"`
	Timestamp    string `json:"timestamp"`
}

// ReceiveRating menerima blob terenkripsi dari FE, verifikasi HMAC, lalu simpan.
func ReceiveRating(c *fiber.Ctx) error {
	var req struct {
		Blob string `json:"blob"`
	}
	if err := c.BodyParser(&req); err != nil || req.Blob == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Pisah blob: base64(payload).base64(sig)
	dotIdx := strings.LastIndex(req.Blob, ".")
	if dotIdx < 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid blob format"})
	}
	payloadB64 := req.Blob[:dotIdx]
	sigB64 := req.Blob[dotIdx+1:]

	payloadJSON, err := base64.StdEncoding.DecodeString(payloadB64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload encoding"})
	}
	receivedSig, err := base64.StdEncoding.DecodeString(sigB64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid signature encoding"})
	}

	// Parse payload dulu untuk dapat license_email
	var p ratingPayload
	if err := json.Unmarshal(payloadJSON, &p); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}
	if p.LicenseEmail == "" || p.Rating < 1 || p.Rating > 5 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid rating data"})
	}

	// Cari license key milik email ini di DB
	var license model.LicenseRequest
	if err := db.DB.Where("email = ? AND status = ?", p.LicenseEmail, "approved").First(&license).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "License not found or not approved"})
	}

	// Verifikasi HMAC: re-compute dengan license key dari DB
	hmacKey := sha256.Sum256([]byte(license.LicenseKey))
	mac := hmac.New(sha256.New, hmacKey[:])
	mac.Write(payloadJSON)
	expectedSig := mac.Sum(nil)

	if !hmac.Equal(receivedSig, expectedSig) {
		log.Warn().Str("email", p.LicenseEmail).Msg("Rating HMAC verification failed")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Signature verification failed"})
	}

	// Parse timestamp
	ratedAt, err := time.Parse(time.RFC3339, p.Timestamp)
	if err != nil {
		ratedAt = time.Now()
	}

	// Simpan rating
	rating := model.InstanceRating{
		LicenseEmail: p.LicenseEmail,
		UserName:     p.UserName,
		UserEmail:    p.UserEmail,
		UserCount:    p.UserCount,
		Rating:       p.Rating,
		Comment:      p.Comment,
		Version:      p.Version,
		RatedAt:      ratedAt,
	}
	if err := db.DB.Create(&rating).Error; err != nil {
		log.Error().Err(err).Msg("Failed to save rating")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save rating"})
	}

	log.Info().Str("license_email", p.LicenseEmail).Int("rating", p.Rating).Msg("Rating received")
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Rating received, thank you!"})
}

// ListRatings mengembalikan semua rating (admin only).
func ListRatings(c *fiber.Ctx) error {
	var ratings []model.InstanceRating
	if err := db.DB.Order("created_at DESC").Find(&ratings).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch ratings"})
	}
	return c.JSON(fiber.Map{"data": ratings, "total": len(ratings)})
}
