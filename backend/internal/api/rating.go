package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func SetupRatingRoutes(app *fiber.App) {
	app.Get("/api/v1/rating/status", middleware.RequireAuth, GetRatingStatus)
	app.Post("/api/v1/rating", middleware.RequireAuth, SubmitRating)
}

func GetRatingStatus(c *fiber.Ctx) error {
	userID := uint(c.Locals("user_id").(float64))

	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	intervalDays := 30
	if v := os.Getenv("RATING_INTERVAL_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			intervalDays = n
		}
	}

	if user.LastRatedAt == nil {
		return c.JSON(fiber.Map{"should_rate": true, "is_overdue": false})
	}
	overdue := time.Now().After(user.LastRatedAt.AddDate(0, 0, intervalDays))
	return c.JSON(fiber.Map{"should_rate": overdue, "is_overdue": overdue})
}

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

func SubmitRating(c *fiber.Ctx) error {
	userID := uint(c.Locals("user_id").(float64))

	var req struct {
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
		Version string `json:"version"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Rating < 1 || req.Rating > 5 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Rating must be between 1 and 5"})
	}

	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	// Throttle check
	intervalDays := 30
	if v := os.Getenv("RATING_INTERVAL_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			intervalDays = n
		}
	}
	if user.LastRatedAt != nil {
		nextAllowed := user.LastRatedAt.AddDate(0, 0, intervalDays)
		if time.Now().Before(nextAllowed) {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":       fmt.Sprintf("Rating hanya bisa dikirim setiap %d hari", intervalDays),
				"next_allowed": nextAllowed.Format(time.RFC3339),
			})
		}
	}

	// Dapatkan license email dari license key di env
	licenseEmail := decodeLicenseEmail(os.Getenv("LICENSE_KEY"))

	// Hitung jumlah user di instance ini
	var userCount int64
	repository.DB.Model(&repository.User{}).Count(&userCount)

	// Buat payload
	p := ratingPayload{
		LicenseEmail: licenseEmail,
		UserName:     user.Name,
		UserEmail:    user.Email,
		UserCount:    userCount,
		Rating:       req.Rating,
		Comment:      req.Comment,
		Version:      req.Version,
		Timestamp:    time.Now().UTC().Format(time.RFC3339),
	}
	payloadJSON, _ := json.Marshal(p)

	// Sign dengan HMAC-SHA256 menggunakan license key sebagai key
	hmacKey := sha256.Sum256([]byte(os.Getenv("LICENSE_KEY")))
	mac := hmac.New(sha256.New, hmacKey[:])
	mac.Write(payloadJSON)
	sig := mac.Sum(nil)

	blob := base64.StdEncoding.EncodeToString(payloadJSON) + "." +
		base64.StdEncoding.EncodeToString(sig)

	// Catat bahwa user sudah rating
	now := time.Now()
	repository.DB.Model(&user).Update("last_rated_at", now)

	return c.JSON(fiber.Map{"blob": blob})
}

// decodeLicenseEmail mengekstrak email dari license key (format: base64(payload).base64(sig))
func decodeLicenseEmail(licenseKey string) string {
	if licenseKey == "" {
		return ""
	}
	dotIdx := strings.LastIndex(licenseKey, ".")
	if dotIdx < 0 {
		return ""
	}
	payloadB64 := licenseKey[:dotIdx]
	payloadJSON, err := base64.StdEncoding.DecodeString(payloadB64)
	if err != nil {
		return ""
	}
	var p struct {
		Email string `json:"email"`
	}
	if err := json.Unmarshal(payloadJSON, &p); err != nil {
		return ""
	}
	return p.Email
}
