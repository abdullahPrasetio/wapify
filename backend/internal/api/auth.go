package api

import (
	"time"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"github.com/waluyo/wapify-backend/internal/repository"
	"os"
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

	// Create JWT token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        user.ID,
		"email":          user.Email,
		"is_super_admin": user.IsSuperAdmin,
		"exp":            time.Now().Add(time.Hour * 2).Unix(), // 2 hours
	})

	t, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Create Refresh Token
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 24 * 30).Unix(), // 30 days
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
		"token": nt,
	})
}

func Logout(c *fiber.Ctx) error {
	// In MVP, logout can just be handled client side by removing the token,
	// but we'll provide the endpoint.
	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}
