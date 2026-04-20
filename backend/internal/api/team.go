package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type CreateTeamRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func SetupTeamRoutes(app *fiber.App) {
	teamGroup := app.Group("/api/v1/teams")
	teamGroup.Use(middleware.RequireAuth)

	teamGroup.Post("/", CreateTeam)
	teamGroup.Get("/", ListTeams)
}

func CreateTeam(c *fiber.Ctx) error {
	req := new(CreateTeamRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	userId := c.Locals("user_id").(float64) // JWT map claims parse numbers as float64
	uid := uint(userId)

	team := repository.Team{
		Name:        req.Name,
		Description: req.Description,
		CreatedByID: &uid,
	}

	if err := repository.DB.Create(&team).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create team", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Make the creator an owner
	teamMember := repository.TeamMember{
		TeamID: team.ID,
		UserID: uid,
		Role:   "Owner",
	}
	
	if err := repository.DB.Create(&teamMember).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to assign team role", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(team)
}

func ListTeams(c *fiber.Ctx) error {
	isSuperAdmin := c.Locals("is_super_admin").(bool)
	userId := c.Locals("user_id").(float64)
	
	var teams []repository.Team

	if isSuperAdmin {
		if err := repository.DB.Find(&teams).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch teams", "code": "INTERNAL_SERVER_ERROR"})
		}
	} else {
		if err := repository.DB.Joins("JOIN team_members ON team_members.team_id = teams.id").
			Where("team_members.user_id = ?", uint(userId)).
			Find(&teams).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch teams", "code": "INTERNAL_SERVER_ERROR"})
		}
	}

	return c.JSON(teams)
}
