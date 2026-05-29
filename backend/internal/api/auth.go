package api

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func SetupAuthRoutes(app *fiber.App) {
	authGroup := app.Group("/api/v1/auth")
	authGroup.Post("/login", Login)
	authGroup.Post("/refresh", Refresh)
	authGroup.Post("/logout", Logout)
	authGroup.Put("/change-password", middleware.RequireAuth, ChangePassword)
	authGroup.Get("/me", middleware.RequireAuth, GetCurrentUser)
}

func GetCurrentUser(c *fiber.Ctx) error {
	raw, ok := c.Locals("user_id").(float64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token", "code": "UNAUTHORIZED"})
	}
	userID := uint(raw)
	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}
	return c.JSON(user)
}

func ChangePassword(c *fiber.Ctx) error {
	userID := uint(c.Locals("user_id").(float64))
	
	var input struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.OldPassword)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Incorrect old password"})
	}

	// Hash new password
	hashed, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user.PasswordHash = string(hashed)
	if err := repository.DB.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update password"})
	}

	return c.JSON(fiber.Map{"message": "Password updated successfully"})
}

func Login(c *fiber.Ctx) error {
	req := new(LoginRequest)
	if err := c.BodyParser(req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	var user repository.User
	if err := repository.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password", "code": "UNAUTHORIZED"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password", "code": "UNAUTHORIZED"})
	}

	// Verify Data Integrity (Mencegah manipulasi database manual)
	// Jika signature ada tapi tidak cocok, berarti data diubah langsung di DB
	if user.RoleSignature != "" && user.RoleSignature != CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Account data integrity violation detected. Access denied.",
			"code":  "INTEGRITY_ERROR",
		})
	}

	// Create JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID,
		"email":          user.Email,
		"is_super_admin": user.IsSuperAdmin,
		"exp":            time.Now().Add(time.Hour * 24).Unix(), // 24 hours
	})

	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Create Refresh Token
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 24 * 90).Unix(), // 90 days
	})

	rt, err := refreshToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate refresh token", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{
		"token":         t,
		"refresh_token": rt,
		"user": fiber.Map{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"is_super_admin": user.IsSuperAdmin,
			"is_premium":     user.IsPremium,
		},
	})
}

func Refresh(c *fiber.Ctx) error {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	token, err := jwt.Parse(req.RefreshToken, func(token *jwt.Token) (interface{}, error) {
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid refresh token", "code": "UNAUTHORIZED"})
	}

	claims := token.Claims.(jwt.MapClaims)
	userID := uint(claims["user_id"].(float64))

	var user repository.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "User not found", "code": "UNAUTHORIZED"})
	}

	// Verify Data Integrity (Mandatory check)
	if user.RoleSignature != CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Account data integrity violation detected. Access denied.",
			"code":  "INTEGRITY_ERROR",
		})
	}

	// Create new JWT token
	newToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID,
		"email":          user.Email,
		"is_super_admin": user.IsSuperAdmin,
		"exp":            time.Now().Add(time.Hour * 2).Unix(),
	})

	nt, err := newToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(fiber.Map{
		"token":         nt,
		"refresh_token": req.RefreshToken,
		"user": fiber.Map{
			"id":             user.ID,
			"email":          user.Email,
			"name":           user.Name,
			"is_super_admin": user.IsSuperAdmin,
			"is_premium":     user.IsPremium,
		},
	})
}

func Logout(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}
