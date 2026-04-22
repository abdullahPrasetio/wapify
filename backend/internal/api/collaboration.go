package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

func SetupCollaborationRoutes(app *fiber.App) {
	v1 := app.Group("/api/v1", middleware.RequireAuth)

	// Versioning
	v1.Post("/requests/:id/versions", createRequestVersion)
	v1.Get("/requests/:id/versions", getRequestVersions)
	v1.Post("/requests/:id/versions/:version_id/rollback", rollbackRequestVersion)

	// Comments
	v1.Post("/requests/:id/comments", createComment)
	v1.Get("/requests/:id/comments", getComments)
	v1.Delete("/comments/:comment_id", deleteComment)

	// Activity Logs
	v1.Get("/teams/:id/activities", getActivities)
}

func createRequestVersion(c *fiber.Ctx) error {
	requestID := c.Params("id")
	userID := uint(c.Locals("user_id").(float64))

	// Parse body for optional version name
	var input struct {
		Name string `json:"name"`
	}
	c.BodyParser(&input)

	var req repository.Request
	if err := repository.DB.Preload("Collection").First(&req, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found"})
	}

	// Check if the latest version is exactly the same, to avoid duplicates
	var latestVersion repository.RequestVersion
	err := repository.DB.Where("request_id = ?", requestID).Order("created_at desc").First(&latestVersion).Error
	if err == nil {
		// Basic equality check. For better accuracy, compare JSON strings.
		// For MVP, we will always save if user asks for it explicitly.
	}

	var namePtr *string
	if input.Name != "" {
		namePtr = &input.Name
	}

	version := repository.RequestVersion{
		RequestID:         req.ID,
		CreatedByID:       userID,
		Name:              namePtr,
		Method:            req.Method,
		URL:               req.URL,
		Headers:           req.Headers,
		Body:              req.Body,
		AuthConfig:        req.AuthConfig,
		PreRequestScript:  req.PreRequestScript,
		PostRequestScript: req.PostRequestScript,
	}

	if err := repository.DB.Create(&version).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create version"})
	}

	// Log activity
	LogActivity(repository.DB, req.Collection.TeamID, userID, "CREATED_VERSION", "REQUEST", req.ID, nil)

	return c.Status(fiber.StatusCreated).JSON(version)
}

func getRequestVersions(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var versions []repository.RequestVersion
	if err := repository.DB.Where("request_id = ?", requestID).Order("created_at desc").Preload("CreatedBy").Find(&versions).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch versions"})
	}
	return c.JSON(versions)
}

func rollbackRequestVersion(c *fiber.Ctx) error {
	requestID := c.Params("id")
	versionID := c.Params("version_id")
	userID := uint(c.Locals("user_id").(float64))

	var version repository.RequestVersion
	if err := repository.DB.First(&version, versionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Version not found"})
	}

	var req repository.Request
	if err := repository.DB.Preload("Collection").First(&req, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found"})
	}

	// Update request with version data
	req.Method = version.Method
	req.URL = version.URL
	req.Headers = version.Headers
	req.Body = version.Body
	req.AuthConfig = version.AuthConfig
	req.PreRequestScript = version.PreRequestScript
	req.PostRequestScript = version.PostRequestScript

	if err := repository.DB.Save(&req).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to rollback"})
	}

	// Broadcast entity update
	WSHub.BroadcastEntityUpdate(req.Collection.TeamID, "REQUEST", req.ID)
	LogActivity(repository.DB, req.Collection.TeamID, userID, "ROLLED_BACK_VERSION", "REQUEST", req.ID, map[string]interface{}{"version_id": version.ID})

	return c.JSON(req)
}

func createComment(c *fiber.Ctx) error {
	requestID := c.Params("id")
	userID := uint(c.Locals("user_id").(float64))

	var input struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid input"})
	}

	var req repository.Request
	if err := repository.DB.Preload("Collection").First(&req, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found"})
	}

	comment := repository.Comment{
		RequestID: req.ID,
		UserID:    userID,
		Content:   input.Content,
	}

	if err := repository.DB.Create(&comment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	// Fetch with user info
	repository.DB.Preload("User").First(&comment, comment.ID)

	LogActivity(repository.DB, req.Collection.TeamID, userID, "ADDED_COMMENT", "REQUEST", req.ID, nil)

	return c.Status(fiber.StatusCreated).JSON(comment)
}

func getComments(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var comments []repository.Comment
	if err := repository.DB.Where("request_id = ?", requestID).Order("created_at asc").Preload("User").Find(&comments).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch comments"})
	}
	return c.JSON(comments)
}

func deleteComment(c *fiber.Ctx) error {
	commentID := c.Params("comment_id")
	userID := uint(c.Locals("user_id").(float64))

	var comment repository.Comment
	if err := repository.DB.Preload("Request.Collection").First(&comment, commentID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Comment not found"})
	}

	// Only author can delete for now, or superadmin
	isSuper := c.Locals("is_super_admin").(bool)
	if !isSuper && comment.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Not authorized to delete this comment"})
	}

	if err := repository.DB.Delete(&comment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete comment"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func getActivities(c *fiber.Ctx) error {
	teamID := c.Params("id")

	// Limit to 50 latest logs
	var logs []repository.ActivityLog
	if err := repository.DB.Where("team_id = ?", teamID).Order("created_at desc").Limit(50).Preload("User").Find(&logs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch activity logs"})
	}
	return c.JSON(logs)
}
