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

// LicensePublicKey is embedded from build process
// This value is replaced during build for client binaries.
var LicensePublicKey = "" // default empty, replaced by -ldflags

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return c.Status(code).JSON(fiber.Map{
				"error": err.Error(),
				"code":  "SERVER_ERROR",
			})
		},
	})

	app.Use(logger.New())
	app.Use(cors.New()) // The PRD says "bebas CORS" since it is from Electron Main Process, but keeping it open for development purposes.

	// License Middleware (Fase 5)
	// If LicensePublicKey is set, this server will require a valid LICENSE_KEY
	app.Use(middleware.CheckLicense(LicensePublicKey))

	repository.ConnectDB()

	// Setup API Routes
	api.SetupAuthRoutes(app)
	api.SetupTeamRoutes(app)
	api.SetupTeamMemberRoutes(app)
	api.SetupCollectionRoutes(app)
	api.SetupFolderRoutes(app)
	api.SetupRequestRoutes(app)
	api.SetupEnvironmentRoutes(app)
	api.SetupAdminRoutes(app)
	api.SetupHistoryRoutes(app)
	api.SetupWebSocketRoutes(app)
	api.SetupCollaborationRoutes(app)
	api.SetupDocumentationRoutes(app)
	api.SetupMockServerRoutes(app)
	api.SetupExampleRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	log.Printf("Starting Wapify Backend on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
