package api

import (
	"fmt"
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

type CreateHistoryRequest struct {
	TeamID          uint             `json:"team_id"`
	RequestID       uint             `json:"request_id"`
	Method          string           `json:"method"`
	URL             string           `json:"url"`
	RequestHeaders  repository.JSONB `json:"request_headers"`
	RequestBody     string           `json:"request_body"`
	ResponseHeaders repository.JSONB `json:"response_headers"`
	ResponseBody    string           `json:"response_body"`
	StatusCode      int              `json:"status_code"`
	ResponseTime    int              `json:"response_time"`
}

func SetupHistoryRoutes(app *fiber.App) {
	history := app.Group("/api/v1/history")
	history.Use(middleware.RequireAuth)

	history.Get("/", GetTeamHistory)
	history.Post("/", CreateHistory)
	history.Delete("/:id", DeleteHistory)
	history.Delete("/", ClearTeamHistory)
}

func GetTeamHistory(c *fiber.Ctx) error {
	teamID := c.Query("team_id")
	if teamID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "team_id query param is required"})
	}

	if !canAccessTeam(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var histories []repository.RequestHistory
	repository.DB.Preload("User").Where("team_id = ?", teamID).Order("created_at desc").Limit(50).Find(&histories)
	return c.JSON(histories)
}

func CreateHistory(c *fiber.Ctx) error {
	userId := c.Locals("user_id").(float64)
	var req CreateHistoryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	if !canAccessTeam(c, req.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	history := repository.RequestHistory{
		UserID:          uint(userId),
		TeamID:          req.TeamID,
		RequestID:       req.RequestID,
		Method:          req.Method,
		URL:             req.URL,
		RequestHeaders:  req.RequestHeaders,
		RequestBody:     req.RequestBody,
		ResponseHeaders: req.ResponseHeaders,
		ResponseBody:    req.ResponseBody,
		StatusCode:      req.StatusCode,
		ResponseTime:    req.ResponseTime,
	}

	if err := repository.DB.Create(&history).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save history", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(history)
}

func DeleteHistory(c *fiber.Ctx) error {
	id := c.Params("id")
	userId := c.Locals("user_id").(float64)

	if err := repository.DB.Where("id = ? AND user_id = ?", id, uint(userId)).Delete(&repository.RequestHistory{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete history", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{"message": "History deleted"})
}

func ClearTeamHistory(c *fiber.Ctx) error {
	teamID := c.Query("team_id")
	fmt.Println("sini teamID", teamID)
	if teamID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "team_id query param is required"})
	}

	if !isAdminOrAbove(c, parseUint(teamID)) {
		log.Printf("Access denied to clear team history for team %s", teamID)
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Admin or Owner can clear team history"})
	}

	if err := repository.DB.Where("team_id = ?", teamID).Delete(&repository.RequestHistory{}).Error; err != nil {
		fmt.Println("sini ", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to clear history", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{"message": "Team history cleared"})
}
