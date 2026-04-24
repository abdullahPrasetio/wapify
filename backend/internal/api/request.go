package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type CreateRequestPayload struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Method      string          `json:"method"`
	URL         string           `json:"url"`
	Headers     repository.JSONB `json:"headers"`
	Body        repository.JSONB `json:"body"`
	BodyType    string           `json:"body_type"`
	AuthConfig  repository.JSONB `json:"auth_config"`
	FolderID    *uint           `json:"folder_id"`
	OrderIndex        int              `json:"order_index"`
	PreRequestScript  string           `json:"pre_request_script"`
	PostRequestScript string           `json:"post_request_script"`
}

func SetupRequestRoutes(app *fiber.App) {
	// Requests under folder
	app.Get("/api/v1/folders/:id/requests", middleware.RequireAuth, ListRequestsInFolder)
	app.Post("/api/v1/folders/:id/requests", middleware.RequireAuth, CreateRequestInFolder)

	// Requests under collection (root level)
	app.Get("/api/v1/collections/:id/requests", middleware.RequireAuth, ListRequestsInCollection)
	app.Post("/api/v1/collections/:id/requests", middleware.RequireAuth, CreateRequestInCollection)

	// Request CRUD
	app.Get("/api/v1/requests/:id", middleware.RequireAuth, GetRequest)
	app.Put("/api/v1/requests/:id", middleware.RequireAuth, UpdateRequest)
	app.Delete("/api/v1/requests/:id", middleware.RequireAuth, DeleteRequest)
	app.Post("/api/v1/requests/:id/duplicate", middleware.RequireAuth, DuplicateRequest)
}

func ListRequestsInFolder(c *fiber.Ctx) error {
	folderID := c.Params("id")
	var folder repository.Folder
	if err := repository.DB.First(&folder, folderID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Folder not found", "code": "NOT_FOUND"})
	}
	var collection repository.Collection
	repository.DB.First(&collection, folder.CollectionID)
	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var requests []repository.Request
	repository.DB.Preload("Examples").Where("folder_id = ?", folderID).Find(&requests)
	return c.JSON(requests)
}

func CreateRequestInFolder(c *fiber.Ctx) error {
	folderID := c.Params("id")
	var folder repository.Folder
	if err := repository.DB.First(&folder, folderID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Folder not found", "code": "NOT_FOUND"})
	}
	var collection repository.Collection
	repository.DB.First(&collection, folder.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var req CreateRequestPayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	userID := uint(c.Locals("user_id").(float64))
	fid := folder.ID
	request := repository.Request{
		Name:         req.Name,
		Description:  req.Description,
		Method:       req.Method,
		URL:          req.URL,
		Headers:      req.Headers,
		Body:         req.Body,
		BodyType:     req.BodyType,
		AuthConfig:   req.AuthConfig,
		CollectionID: collection.ID,
		FolderID:           &fid,
		CreatedByID:        &userID,
		OrderIndex:         req.OrderIndex,
		PreRequestScript:   req.PreRequestScript,
		PostRequestScript:  req.PostRequestScript,
	}
	if err := repository.DB.Create(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "CREATED_REQUEST", "REQUEST", request.ID, map[string]interface{}{"name": request.Name})

	return c.Status(fiber.StatusCreated).JSON(request)
}

func ListRequestsInCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var requests []repository.Request
	// Return all requests in collection (including nested ones)
	repository.DB.Preload("Examples").Where("collection_id = ?", collectionID).Find(&requests)
	return c.JSON(requests)
}

func CreateRequestInCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var req CreateRequestPayload
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	userID := uint(c.Locals("user_id").(float64))
	request := repository.Request{
		Name:         req.Name,
		Description:  req.Description,
		Method:       req.Method,
		URL:          req.URL,
		Headers:      req.Headers,
		Body:         req.Body,
		BodyType:     req.BodyType,
		AuthConfig:   req.AuthConfig,
		CollectionID: collection.ID,
		FolderID:           req.FolderID,
		CreatedByID:        &userID,
		OrderIndex:         req.OrderIndex,
		PreRequestScript:   req.PreRequestScript,
		PostRequestScript:  req.PostRequestScript,
	}
	if err := repository.DB.Create(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "CREATED_REQUEST", "REQUEST", request.ID, map[string]interface{}{"name": request.Name})

	return c.Status(fiber.StatusCreated).JSON(request)
}

func GetRequest(c *fiber.Ctx) error {
	requestID := c.Params("id")
	
	// Validate that ID is a number to prevent SQL injection or malformed queries
	var request repository.Request
	if err := repository.DB.Preload("Examples").First(&request, "id = ?", requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}
	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	return c.JSON(request)
}

func UpdateRequest(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var request repository.Request
	if err := repository.DB.First(&request, "id = ?", requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}
	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	
	// Gunakan map generic untuk menangkap field yang dikirim secara eksplisit
	var updateData map[string]interface{}
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	// Update field satu per satu agar field kosong tetap terupdate
	if name, ok := updateData["name"].(string); ok && name != "" {
		request.Name = name
	}
	if method, ok := updateData["method"].(string); ok && method != "" {
		request.Method = method
	}
	if url, ok := updateData["url"].(string); ok && url != "" {
		request.URL = url
	}
	
	// Headers dan Body diperbolehkan kosong
	if headers, ok := updateData["headers"]; ok {
		request.Headers = repository.JSONB(headers.(map[string]interface{}))
	}
	if body, ok := updateData["body"]; ok {
		if bArray, ok := body.([]interface{}); ok {
			// Jika body berupa array (form-data/urlencoded)
			request.Body = repository.JSONB{"array": bArray} // Bungkus agar konsisten JSONB
		} else {
			request.Body = repository.JSONB(body.(map[string]interface{}))
		}
	}
	if bodyType, ok := updateData["body_type"].(string); ok {
		request.BodyType = bodyType
	}
	if authConfig, ok := updateData["auth_config"]; ok {
		request.AuthConfig = repository.JSONB(authConfig.(map[string]interface{}))
	}
	if pre, ok := updateData["pre_request_script"].(string); ok {
		request.PreRequestScript = pre
	}
	if post, ok := updateData["post_request_script"].(string); ok {
		request.PostRequestScript = post
	}

	if err := repository.DB.Save(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "REQUEST", request.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "UPDATED_REQUEST", "REQUEST", request.ID, nil)

	return c.JSON(request)
}

func DeleteRequest(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var request repository.Request
	if err := repository.DB.First(&request, "id = ?", requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}
	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	if err := repository.DB.Delete(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "DELETED_REQUEST", "REQUEST", request.ID, map[string]interface{}{"name": request.Name})

	return c.JSON(fiber.Map{"message": "Request deleted successfully"})
}

func DuplicateRequest(c *fiber.Ctx) error {
	requestID := c.Params("id")
	var original repository.Request
	if err := repository.DB.First(&original, "id = ?", requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}

	var collection repository.Collection
	repository.DB.First(&collection, original.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	userID := uint(c.Locals("user_id").(float64))
	
	// Create a copy
	newRequest := repository.Request{
		Name:              original.Name + " Copy",
		Description:       original.Description,
		Method:            original.Method,
		URL:               original.URL,
		Headers:           original.Headers,
		Body:              original.Body,
		BodyType:          original.BodyType,
		AuthConfig:        original.AuthConfig,
		CollectionID:      original.CollectionID,
		FolderID:          original.FolderID,
		CreatedByID:       &userID,
		OrderIndex:        original.OrderIndex + 1,
		PreRequestScript:  original.PreRequestScript,
		PostRequestScript: original.PostRequestScript,
	}

	if err := repository.DB.Create(&newRequest).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to duplicate request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "DUPLICATED_REQUEST", "REQUEST", newRequest.ID, map[string]interface{}{"name": newRequest.Name})

	return c.Status(fiber.StatusCreated).JSON(newRequest)
}
