package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"github.com/waluyo/wapify-backend/internal/api"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

// LicensePublicKey can be injected via -ldflags during build
var LicensePublicKey = ""

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: No .env file found")
	}

	// Initialize Database
	repository.ConnectDB()

	// Sync User Integrity Signatures
	api.SyncUserSignatures()

	app := fiber.New(fiber.Config{
		AppName: "Wapify API Server",
	})

	// Middlewares
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:  "*",
		AllowHeaders:  "Origin, Content-Type, Accept, Authorization, X-Wapify-License-Warning",
		ExposeHeaders: "X-Wapify-License-Warning",
	}))

	// License Middleware (Offline Validation)
	// It will only enforce check if LicensePublicKey is present (Client Mode)
	app.Use(middleware.CheckLicense(LicensePublicKey))

	// Setup API Routes
	api.SetupAuthRoutes(app)
	api.SetupAdminRoutes(app)
	api.SetupTeamRoutes(app)
	api.SetupCollectionRoutes(app)
	api.SetupFolderRoutes(app)
	api.SetupRequestRoutes(app)
	api.SetupHistoryRoutes(app)
	api.SetupEnvironmentRoutes(app)
	api.SetupWebSocketRoutes(app)
	api.SetupCollaborationRoutes(app)
	api.SetupDocumentationRoutes(app)
	api.SetupMockServerRoutes(app)
	api.SetupExampleRoutes(app)

	// Default Route
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Wapify API Engine is running",
			"status":  "healthy",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Starting Wapify Backend on port %s", port)
	if LicensePublicKey != "" {
		log.Println("Security: Ed25519 License Verification is ACTIVE")
	}

	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
