package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type AddMemberRequest struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
}

type UpdateMemberRequest struct {
	Role string `json:"role"`
}

func SetupTeamMemberRoutes(app *fiber.App) {
	teamGroup := app.Group("/api/v1/teams/:id", middleware.RequireAuth)
	teamGroup.Get("/", GetTeamDetail)
	teamGroup.Put("/", UpdateTeam)
	teamGroup.Delete("/", DeleteTeam)
	teamGroup.Post("/members", AddTeamMember)
	teamGroup.Put("/members/:userId", UpdateTeamMember)
	teamGroup.Delete("/members/:userId", RemoveTeamMember)
}

func GetTeamDetail(c *fiber.Ctx) error {
	teamID := c.Params("id")

	var team repository.Team
	if err := repository.DB.First(&team, teamID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Team not found", "code": "NOT_FOUND"})
	}

	if !canAccessTeam(c, team.ID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var members []repository.TeamMember
	repository.DB.Preload("User").Where("team_id = ?", team.ID).Find(&members)

	return c.JSON(fiber.Map{
		"team":    team,
		"members": members,
	})
}

func UpdateTeam(c *fiber.Ctx) error {
	teamID := c.Params("id")

	var team repository.Team
	if err := repository.DB.First(&team, teamID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Team not found", "code": "NOT_FOUND"})
	}

	if !isAdminOrAbove(c, team.ID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Admin or Owner can update team settings", "code": "FORBIDDEN"})
	}

	var req CreateTeamRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	if req.Name != "" {
		team.Name = req.Name
	}
	if req.Description != "" {
		team.Description = req.Description
	}

	if err := repository.DB.Save(&team).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update team", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(team)
}

func DeleteTeam(c *fiber.Ctx) error {
	teamID := c.Params("id")
	isSuperAdmin := c.Locals("is_super_admin").(bool)
	userID := uint(c.Locals("user_id").(float64))

	var team repository.Team
	if err := repository.DB.First(&team, teamID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Team not found", "code": "NOT_FOUND"})
	}

	// Only Owner or Super Admin can delete
	if !isSuperAdmin {
		var member repository.TeamMember
		if err := repository.DB.Where("team_id = ? AND user_id = ? AND role = 'Owner'", team.ID, userID).First(&member).Error; err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Owner or Super Admin can delete a team", "code": "FORBIDDEN"})
		}
	}

	if err := repository.DB.Delete(&team).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete team", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{"message": "Team deleted successfully"})
}

func AddTeamMember(c *fiber.Ctx) error {
	teamID := c.Params("id")

	var team repository.Team
	if err := repository.DB.First(&team, teamID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Team not found", "code": "NOT_FOUND"})
	}

	if !isAdminOrAbove(c, team.ID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Admin or above can add members", "code": "FORBIDDEN"})
	}

	var req AddMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	// Safety: Owner role can only be assigned during team creation
	if req.Role == "Owner" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot assign Owner role", "code": "BAD_REQUEST"})
	}

	// Check user exists
	var user repository.User
	if err := repository.DB.First(&user, req.UserID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found", "code": "NOT_FOUND"})
	}

	member := repository.TeamMember{
		TeamID: team.ID,
		UserID: req.UserID,
		Role:   req.Role,
	}

	if err := repository.DB.Create(&member).Error; err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "User is already a member of this team", "code": "CONFLICT"})
	}

	return c.Status(fiber.StatusCreated).JSON(member)
}

func UpdateTeamMember(c *fiber.Ctx) error {
	teamID := c.Params("id")
	targetUserID := c.Params("userId")

	if !isAdminOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req UpdateMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	// Safety: Cannot change someone's role to Owner
	if req.Role == "Owner" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot assign Owner role", "code": "BAD_REQUEST"})
	}

	result := repository.DB.Model(&repository.TeamMember{}).
		Where("team_id = ? AND user_id = ?", teamID, targetUserID).
		Update("role", req.Role)

	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Member not found", "code": "NOT_FOUND"})
	}

	return c.JSON(fiber.Map{"message": "Member role updated"})
}

func UpdateTeamMemberRole(c *fiber.Ctx) error {
	teamID := parseUint(c.Params("id"))
	userID := parseUint(c.Params("userId"))

	if !isAdminOrAbove(c, teamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only Admin or Owner can change member roles", "code": "FORBIDDEN"})
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	// Update the role
	if err := repository.DB.Model(&repository.TeamMember{}).Where("team_id = ? AND user_id = ?", teamID, userID).Update("role", req.Role).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update role", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{"message": "Role updated successfully"})
}

func RemoveTeamMember(c *fiber.Ctx) error {
	teamID := c.Params("id")
	targetUserID := c.Params("userId")

	if !isAdminOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	result := repository.DB.Where("team_id = ? AND user_id = ?", teamID, targetUserID).
		Delete(&repository.TeamMember{})

	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Member not found", "code": "NOT_FOUND"})
	}

	return c.JSON(fiber.Map{"message": "Member removed from team"})
}

// --- Helpers ---

func canAccessTeam(c *fiber.Ctx, teamID uint) bool {
	isSuperAdmin := c.Locals("is_super_admin").(bool)
	if isSuperAdmin {
		return true
	}
	userID := uint(c.Locals("user_id").(float64))
	var member repository.TeamMember
	err := repository.DB.Where("team_id = ? AND user_id = ?", teamID, userID).First(&member).Error
	return err == nil
}

func isAdminOrAbove(c *fiber.Ctx, teamID uint) bool {
	isSuperAdmin := c.Locals("is_super_admin").(bool)
	if isSuperAdmin {
		return true
	}
	userID := uint(c.Locals("user_id").(float64))
	var member repository.TeamMember
	err := repository.DB.Where("team_id = ? AND user_id = ? AND role IN ('Owner','Admin')", teamID, userID).First(&member).Error
	return err == nil
}

func isEditorOrAbove(c *fiber.Ctx, teamID uint) bool {
	isSuperAdmin := c.Locals("is_super_admin").(bool)
	if isSuperAdmin {
		return true
	}
	userID := uint(c.Locals("user_id").(float64))
	var member repository.TeamMember
	err := repository.DB.Where("team_id = ? AND user_id = ? AND role IN ('Owner','Admin','Editor')", teamID, userID).First(&member).Error
	return err == nil
}

func parseUint(s string) uint {
	var n uint
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + uint(c-'0')
		}
	}
	return n
}
