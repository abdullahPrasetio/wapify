package main

import (
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	"github.com/waluyo/wapbolt-backend/internal/api"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

// LicensePublicKey can be injected via -ldflags during build
var LicensePublicKey = ""

func main() {
	if err := Run(); err != nil {
		log.Fatalf("Fatal: %v", err)
	}
}

func Run() error {
	app, addr, err := PrepareServer()
	if err != nil {
		return err
	}

	log.Printf("Starting Wapbolt Backend on %s", addr)
	if LicensePublicKey != "" {
		log.Println("Security: Ed25519 License Verification is ACTIVE")
	}

	return app.Listen(addr)
}

func PrepareServer() (*fiber.App, string, error) {
	if os.Getenv("GO_ENV") != "test" {
		// Load environment variables
		if err := godotenv.Load(); err != nil {
			log.Println("Warning: No .env file found")
		}

		// Initialize Database
		if err := repository.ConnectDB(); err != nil {
			return nil, "", err
		}
	}

	// Sync User Integrity Signatures
	api.SyncUserSignatures()

	// Notification Cleanup (Background)
	go api.CleanupOldNotifications()

	app := SetupApp()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	return app, ":" + port, nil
}

func SetupApp() *fiber.App {
	app := fiber.New(fiber.Config{
		AppName: "Wapbolt API Server",
	})

	// Middlewares
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:  "*",
		AllowHeaders:  "Origin, Content-Type, Accept, Authorization, X-Wapbolt-License-Warning",
		ExposeHeaders: "X-Wapbolt-License-Warning",
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
	api.SetupSearchRoutes(app)
	api.SetupEnvironmentRoutes(app)
	api.SetupWebSocketRoutes(app)
	api.SetupCollaborationRoutes(app)
	api.SetupDocumentationRoutes(app)
	api.SetupMockServerRoutes(app)
	api.SetupExampleRoutes(app)
	api.SetupDonationRoutes(app)
	api.SetupNotificationRoutes(app)

	// Default Route
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Wapbolt API Engine is running",
			"status":  "healthy",
		})
	})

	return app
}
