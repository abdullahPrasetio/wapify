package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type CreateExamplePayload struct {
	Name            string           `json:"name"`
	RequestMethod   string           `json:"request_method"`
	RequestURL      string           `json:"request_url"`
	RequestHeaders  repository.JSONB `json:"request_headers"`
	RequestBody     string           `json:"request_body"`
	ResponseStatus  int              `json:"response_status"`
	ResponseHeaders repository.JSONB `json:"response_headers"`
	ResponseBody    string           `json:"response_body"`
}

func SetupExampleRoutes(app *fiber.App) {
	app.Post("/api/v1/requests/:id/examples", middleware.RequireAuth, CreateExample)
	app.Put("/api/v1/examples/:id", middleware.RequireAuth, UpdateExample)
	app.Delete("/api/v1/examples/:id", middleware.RequireAuth, DeleteExample)
}

func CreateExample(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var req CreateExamplePayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "details": err.Error(), "code": "BAD_REQUEST"})
	}

	var request repository.Request
	if err := repository.DB.First(&request, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}

	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	example := repository.RequestExample{
		RequestID:       request.ID,
		Name:            req.Name,
		RequestMethod:   req.RequestMethod,
		RequestURL:      req.RequestURL,
		RequestHeaders:  req.RequestHeaders,
		RequestBody:     req.RequestBody,
		ResponseStatus:  req.ResponseStatus,
		ResponseHeaders: req.ResponseHeaders,
		ResponseBody:    req.ResponseBody,
	}

	if err := repository.DB.Create(&example).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create example", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast
	WSHub.BroadcastEntityUpdate(collection.TeamID, "REQUEST", request.ID)

	return c.Status(fiber.StatusCreated).JSON(example)
}

func UpdateExample(c *fiber.Ctx) error {
	exampleID := c.Params("id")
	var req CreateExamplePayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	var example repository.RequestExample
	if err := repository.DB.First(&example, exampleID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Example not found", "code": "NOT_FOUND"})
	}

	var request repository.Request
	repository.DB.First(&request, example.RequestID)
	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	if req.Name != "" {
		example.Name = req.Name
	}
	if req.RequestMethod != "" {
		example.RequestMethod = req.RequestMethod
	}
	if req.RequestURL != "" {
		example.RequestURL = req.RequestURL
	}
	if req.RequestHeaders != nil {
		example.RequestHeaders = req.RequestHeaders
	}
	if req.RequestBody != "" {
		example.RequestBody = req.RequestBody
	}
	if req.ResponseStatus != 0 {
		example.ResponseStatus = req.ResponseStatus
	}
	if req.ResponseHeaders != nil {
		example.ResponseHeaders = req.ResponseHeaders
	}
	if req.ResponseBody != "" {
		example.ResponseBody = req.ResponseBody
	}

	if err := repository.DB.Save(&example).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update example", "code": "INTERNAL_SERVER_ERROR"})
	}

	WSHub.BroadcastEntityUpdate(collection.TeamID, "REQUEST", request.ID)

	return c.JSON(example)
}

func DeleteExample(c *fiber.Ctx) error {
	exampleID := c.Params("id")
	var example repository.RequestExample
	if err := repository.DB.First(&example, exampleID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Example not found", "code": "NOT_FOUND"})
	}

	var request repository.Request
	repository.DB.First(&request, example.RequestID)
	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)

	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	if err := repository.DB.Delete(&example).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete example", "code": "INTERNAL_SERVER_ERROR"})
	}

	WSHub.BroadcastEntityUpdate(collection.TeamID, "REQUEST", request.ID)

	return c.JSON(fiber.Map{"message": "Example deleted successfully"})
}
