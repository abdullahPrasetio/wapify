package api

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func SetupDonationRoutes(app *fiber.App) {
	donation := app.Group("/api/v1/donations")
	donation.Use(middleware.RequireAuth)

	donation.Get("/check", CheckDonationStatus)
	donation.Post("/mark-seen", MarkDonationSeen)

	admin := app.Group("/api/v1/admin/donations")
	admin.Use(middleware.RequireAuth)
	admin.Use(middleware.RequireSuperAdmin)

	admin.Get("/config", GetDonationConfig)
	admin.Put("/config", UpdateDonationConfig)
	admin.Post("/trigger", TriggerDonationPrompt)
}

func CheckDonationStatus(c *fiber.Ctx) error {
	userID := uint(c.Locals("user_id").(float64))
	log.Info().Uint("user_id", userID).Msg("Checking donation status")

	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	// Check if donation is active
	var activeSetting repository.SystemSetting
	repository.DB.Where("key = ?", "donation_active").First(&activeSetting)
	if activeSetting.Value != "true" {
		return c.JSON(fiber.Map{"show": false})
	}

	// Check cooldown
	var cooldownSetting repository.SystemSetting
	repository.DB.Where("key = ?", "donation_cooldown_days").First(&cooldownSetting)
	cooldownDays, _ := strconv.Atoi(cooldownSetting.Value)
	if cooldownDays <= 0 {
		cooldownDays = 7 // Default 7 days
	}

	if user.LastDonationPromptAt != nil {
		if time.Since(*user.LastDonationPromptAt).Hours() < float64(cooldownDays*24) {
			return c.JSON(fiber.Map{"show": false})
		}
	}

	// Get message
	var msgSetting repository.SystemSetting
	repository.DB.Where("key = ?", "donation_message").First(&msgSetting)
	message := msgSetting.Value
	if message == "" {
		message = "Dukung pengembangan Wapbolt dengan donasi seikhlasnya via QRIS."
	}

	return c.JSON(fiber.Map{
		"show":    true,
		"message": message,
	})
}

func MarkDonationSeen(c *fiber.Ctx) error {
	userID := uint(c.Locals("user_id").(float64))
	now := time.Now()
	log.Info().Uint("user_id", userID).Msg("Marking donation as seen")

	if err := repository.DB.Model(&repository.User{}).Where("id = ?", userID).Update("last_donation_prompt_at", now).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update user preference"})
	}

	return c.JSON(fiber.Map{"status": "success"})
}

func GetDonationConfig(c *fiber.Ctx) error {
	var settings []repository.SystemSetting
	repository.DB.Where("key LIKE ?", "donation_%").Find(&settings)

	config := make(map[string]string)
	for _, s := range settings {
		config[s.Key] = s.Value
	}

	// Ensure default values if missing
	if _, ok := config["donation_active"]; !ok {
		config["donation_active"] = "false"
	}
	if _, ok := config["donation_cooldown_days"]; !ok {
		config["donation_cooldown_days"] = "7"
	}
	if _, ok := config["donation_message"]; !ok {
		config["donation_message"] = "Dukung pengembangan Wapbolt dengan donasi seikhlasnya via QRIS."
	}

	return c.JSON(config)
}

func UpdateDonationConfig(c *fiber.Ctx) error {
	var req map[string]string
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	for k, v := range req {
		setting := repository.SystemSetting{Key: k, Value: v, UpdatedAt: time.Now()}
		repository.DB.Save(&setting)
	}

	return c.JSON(fiber.Map{"status": "success"})
}

func TriggerDonationPrompt(c *fiber.Ctx) error {
	var req struct {
		UserID  uint   `json:"user_id"` // 0 for all
		Message string `json:"message"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if req.Message == "" {
		var msgSetting repository.SystemSetting
		repository.DB.Where("key = ?", "donation_message").First(&msgSetting)
		req.Message = msgSetting.Value
		if req.Message == "" {
			req.Message = "Dukung pengembangan Wapbolt dengan donasi seikhlasnya via QRIS."
		}
	}

	WSHub.BroadcastDonationPrompt(req.UserID, req.Message)

	return c.JSON(fiber.Map{"status": "success", "message": "Triggered successfully"})
}
