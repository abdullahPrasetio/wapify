package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func SetupConfluenceRoutes(app *fiber.App) {
	// Authenticated routes
	conf := app.Group("/api/v1/confluence")
	conf.Use(middleware.RequireAuth)
	
	conf.Get("/config", GetConfluencePublicConfig) // Returns global enabled + user personal settings
	conf.Get("/user-config", GetUserConfluenceConfig) // Returns only user personal settings
	conf.Put("/user-config", UpdateUserConfluenceConfig) // Updates only user personal settings

	// Admin routes (only for on/off feature)
	admin := app.Group("/api/v1/admin/confluence")
	admin.Use(middleware.RequireAuth)
	admin.Use(middleware.RequireSuperAdmin)
	admin.Get("/config", GetConfluenceAdminConfig)
	admin.Put("/config", UpdateConfluenceConfig)
}

func GetConfluencePublicConfig(c *fiber.Ctx) error {
	userIDRaw := c.Locals("user_id")
	var userID uint
	if f, ok := userIDRaw.(float64); ok {
		userID = uint(f)
	} else if u, ok := userIDRaw.(uint); ok {
		userID = u
	}

	// 1. Check Global Enabled
	var enabledSetting repository.SystemSetting
	repository.DB.Where("key = ?", "confluence_enabled").First(&enabledSetting)
	
	if enabledSetting.Value != "true" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"enabled": false, "error": "Confluence integration is disabled by admin"})
	}

	// 2. Get User Specific Settings
	var userSettings repository.UserConfluenceSetting
	repository.DB.Where("user_id = ?", userID).First(&userSettings)

	return c.JSON(fiber.Map{
		"enabled":              true,
		"base_url":             userSettings.BaseURL,
		"confluence_email":     userSettings.ConfluenceEmail,
		"confluence_pat":       userSettings.ConfluencePAT,
		"confluence_api_token": userSettings.ConfluenceAPIToken,
		"space_key":            userSettings.SpaceKey,
		"auth_method":          userSettings.AuthMethod,
	})
}

func GetUserConfluenceConfig(c *fiber.Ctx) error {
	userIDRaw := c.Locals("user_id")
	var userID uint
	if f, ok := userIDRaw.(float64); ok {
		userID = uint(f)
	} else if u, ok := userIDRaw.(uint); ok {
		userID = u
	}

	var userSettings repository.UserConfluenceSetting
	repository.DB.Where("user_id = ?", userID).First(&userSettings)

	return c.JSON(userSettings)
}

func UpdateUserConfluenceConfig(c *fiber.Ctx) error {
	userIDRaw := c.Locals("user_id")
	var userID uint
	if f, ok := userIDRaw.(float64); ok {
		userID = uint(f)
	} else if u, ok := userIDRaw.(uint); ok {
		userID = u
	}

	var req struct {
		BaseURL            string `json:"base_url"`
		ConfluenceEmail    string `json:"confluence_email"`
		ConfluencePAT      string `json:"confluence_pat"`
		ConfluenceAPIToken string `json:"confluence_api_token"`
		SpaceKey           string `json:"space_key"`
		AuthMethod         string `json:"auth_method"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	setting := repository.UserConfluenceSetting{
		UserID:             userID,
		BaseURL:            req.BaseURL,
		ConfluenceEmail:    req.ConfluenceEmail,
		ConfluencePAT:      req.ConfluencePAT,
		ConfluenceAPIToken: req.ConfluenceAPIToken,
		SpaceKey:           req.SpaceKey,
		AuthMethod:         req.AuthMethod,
		UpdatedAt:          time.Now(),
	}

	if err := repository.DB.Save(&setting).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save settings"})
	}

	return c.JSON(fiber.Map{"status": "success", "settings": setting})
}

func GetConfluenceAdminConfig(c *fiber.Ctx) error {
	var enabledSetting repository.SystemSetting
	repository.DB.Where("key = ?", "confluence_enabled").First(&enabledSetting)

	return c.JSON(fiber.Map{
		"confluence_enabled": enabledSetting.Value,
	})
}

func UpdateConfluenceConfig(c *fiber.Ctx) error {
	var req map[string]string
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	val, ok := req["confluence_enabled"]
	if ok {
		setting := repository.SystemSetting{Key: "confluence_enabled", Value: val, UpdatedAt: time.Now()}
		repository.DB.Save(&setting)
	}

	return c.JSON(fiber.Map{"status": "success"})
}
