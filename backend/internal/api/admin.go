package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type CreateUserRequest struct {
	Name         string `json:"name"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	IsSuperAdmin bool   `json:"is_super_admin"`
	TeamID       uint   `json:"team_id,omitempty"`
	Role         string `json:"role,omitempty"`
}

func SetupAdminRoutes(app *fiber.App) {
	admin := app.Group("/api/v1/admin")
	admin.Use(middleware.RequireAuth)
	admin.Use(middleware.RequireSuperAdmin)

	admin.Get("/users", ListAllUsers)
	admin.Post("/users", CreateUser)
	admin.Get("/teams", ListAllTeams)
	admin.Delete("/users/:id", DeleteUser)
	
	// Team Member Management for Admin
	admin.Post("/teams/:id/members", AdminAddTeamMember)
	admin.Delete("/teams/:id/members/:userId", AdminRemoveTeamMember)
}

func ListAllUsers(c *fiber.Ctx) error {
	var users []repository.User
	if err := repository.DB.Find(&users).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch users", "code": "INTERNAL_SERVER_ERROR"})
	}
	return c.JSON(users)
}

func CreateUser(c *fiber.Ctx) error {
	var req CreateUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password", "code": "INTERNAL_SERVER_ERROR"})
	}

	var user repository.User
	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		user = repository.User{
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: string(hashedPassword),
			IsSuperAdmin: req.IsSuperAdmin,
		}

		if err := tx.Create(&user).Error; err != nil {
			return err
		}

		// Assign to team if provided
		if req.TeamID > 0 {
			role := req.Role
			if role == "" {
				role = "Editor"
			}
			member := repository.TeamMember{
				TeamID: req.TeamID,
				UserID: user.ID,
				Role:   role,
			}
			if err := tx.Create(&member).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user or assign team", "code": "USER_CREATION_FAILED"})
	}

	// Send welcome email (non-blocking) - Dimatikan sementara sesuai permintaan
	// go func() {
	// 	err := email.SendWelcomeEmail(req.Email, req.Name, req.Password)
	// 	if err != nil {
	// 		fmt.Printf("Failed to send welcome email: %v\n", err)
	// 	}
	// }()

	return c.Status(fiber.StatusCreated).JSON(user)
}

func ListAllTeams(c *fiber.Ctx) error {
	var teams []repository.Team
	// Preload creator for better info
	if err := repository.DB.Preload("CreatedBy").Find(&teams).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch teams", "code": "INTERNAL_SERVER_ERROR"})
	}
	return c.JSON(teams)
}

func AdminAddTeamMember(c *fiber.Ctx) error {
	teamID := parseUint(c.Params("id"))
	var req struct {
		UserID uint   `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	// Safety: Cannot assign Owner role via this endpoint
	if req.Role == "Owner" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot assign Owner role"})
	}

	member := repository.TeamMember{
		TeamID: teamID,
		UserID: req.UserID,
		Role:   req.Role,
	}
	if err := repository.DB.Create(&member).Error; err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "User already in team"})
	}

	// Preload User for frontend
	repository.DB.Preload("User").First(&member, member.ID)

	return c.JSON(member)
}

func AdminRemoveTeamMember(c *fiber.Ctx) error {
	teamID := c.Params("id")
	userID := c.Params("userId")
	if err := repository.DB.Where("team_id = ? AND user_id = ?", teamID, userID).Delete(&repository.TeamMember{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to remove member"})
	}
	return c.JSON(fiber.Map{"message": "Member removed"})
}

func DeleteUser(c *fiber.Ctx) error {
	id := c.Params("id")
	
	currentUserID := uint(c.Locals("user_id").(float64))
	if parseUint(id) == currentUserID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "You cannot delete yourself", "code": "BAD_REQUEST"})
	}

	if err := repository.DB.Delete(&repository.User{}, id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete user", "code": "INTERNAL_SERVER_ERROR"})
	}
	return c.JSON(fiber.Map{"message": "User deleted successfully"})
}
