package main

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-license-server/db"
	"github.com/waluyo/wapbolt-license-server/handler"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Warn().Msg("No .env file found, relying on environment variables")
	}

	if err := db.Connect(); err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}

	app := fiber.New(fiber.Config{AppName: "Wapbolt License Server"})

	app.Use(logger.New())

	allowOrigins := os.Getenv("CORS_ORIGINS")
	if allowOrigins == "" {
		log.Fatal().Msg("CORS_ORIGINS env is required — set to your landing page URL, e.g. https://wapbolt.io")
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins: allowOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, X-Admin-Key",
		AllowMethods: "GET,POST,PATCH,DELETE,OPTIONS",
	}))

	// Rate limit per IP: max 5 requests per 10 menit untuk endpoint public
	ipLimiter := limiter.New(limiter.Config{
		Max:        5,
		Expiration: 10 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Terlalu banyak request. Coba lagi dalam 10 menit.",
			})
		},
	})

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy", "service": "wapbolt-license-server"})
	})

	// Public — dengan rate limiter
	app.Post("/api/license-requests", ipLimiter, handler.SubmitRequest)

	// Admin (protected by X-Admin-Key header)
	admin := app.Group("/api/admin/license-requests", handler.RequireAdminKey)
	admin.Get("/", handler.ListRequests)
	admin.Patch("/:id/revoke", handler.RevokeRequest)
	admin.Delete("/:id", handler.DeleteRequest)

	port := getEnv("PORT", "9100")
	log.Info().Str("port", port).Msg("Starting Wapbolt License Server")
	if err := app.Listen(":" + port); err != nil {
		log.Fatal().Err(err).Msg("Server stopped")
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
