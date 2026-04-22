package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type CreateEnvironmentRequest struct {
	Name      string          `json:"name"`
	Variables repository.JSONB `json:"variables"`
}

func SetupEnvironmentRoutes(app *fiber.App) {
	app.Get("/api/v1/teams/:id/environments", middleware.RequireAuth, ListEnvironments)
	app.Post("/api/v1/teams/:id/environments", middleware.RequireAuth, CreateEnvironment)
	app.Get("/api/v1/environments/:id", middleware.RequireAuth, GetEnvironment)
	app.Put("/api/v1/environments/:id", middleware.RequireAuth, UpdateEnvironment)
	app.Delete("/api/v1/environments/:id", middleware.RequireAuth, DeleteEnvironment)
}

func ListEnvironments(c *fiber.Ctx) error {
	teamID := c.Params("id")
	if !canAccessTeam(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var envs []repository.Environment
	repository.DB.Where("team_id = ?", teamID).Find(&envs)
	return c.JSON(envs)
}

func CreateEnvironment(c *fiber.Ctx) error {
	teamID := c.Params("id")
	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var req CreateEnvironmentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	env := repository.Environment{
		Name:      req.Name,
		Variables: req.Variables,
		TeamID:    parseUint(teamID),
	}
	if err := repository.DB.Create(&env).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create environment", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(env.TeamID, "TEAM", env.TeamID)
	LogActivity(repository.DB, env.TeamID, userID, "CREATED_ENVIRONMENT", "ENVIRONMENT", env.ID, map[string]interface{}{"name": env.Name})

	return c.Status(fiber.StatusCreated).JSON(env)
}

func GetEnvironment(c *fiber.Ctx) error {
	envID := c.Params("id")
	var env repository.Environment
	if err := repository.DB.First(&env, envID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Environment not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, env.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	return c.JSON(env)
}

func UpdateEnvironment(c *fiber.Ctx) error {
	envID := c.Params("id")
	var env repository.Environment
	if err := repository.DB.First(&env, envID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Environment not found", "code": "NOT_FOUND"})
	}
	if !isEditorOrAbove(c, env.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var req CreateEnvironmentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	if req.Name != "" {
		env.Name = req.Name
	}
	if req.Variables != nil {
		env.Variables = req.Variables
	}
	if err := repository.DB.Save(&env).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update environment", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(env.TeamID, "TEAM", env.TeamID)
	LogActivity(repository.DB, env.TeamID, userID, "UPDATED_ENVIRONMENT", "ENVIRONMENT", env.ID, nil)

	return c.JSON(env)
}

func DeleteEnvironment(c *fiber.Ctx) error {
	envID := c.Params("id")
	var env repository.Environment
	if err := repository.DB.First(&env, envID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Environment not found", "code": "NOT_FOUND"})
	}
	if !isEditorOrAbove(c, env.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	if err := repository.DB.Delete(&env).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete environment", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(env.TeamID, "TEAM", env.TeamID)
	LogActivity(repository.DB, env.TeamID, userID, "DELETED_ENVIRONMENT", "ENVIRONMENT", env.ID, map[string]interface{}{"name": env.Name})

	return c.JSON(fiber.Map{"message": "Environment deleted successfully"})
}
