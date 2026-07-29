package api

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

type CreateRequestPayload struct {
	Name              string           `json:"name"`
	Description       string           `json:"description"`
	Method            string           `json:"method"`
	URL               string           `json:"url"`
	Headers           repository.JSONB `json:"headers"`
	Body              repository.JSONB `json:"body"`
	BodyType          string           `json:"body_type"`
	AuthConfig        repository.JSONB `json:"auth_config"`
	FolderID          *uint            `json:"folder_id"`
	OrderIndex        float64          `json:"order_index"`
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
	app.Patch("/api/v1/requests/:id/move", middleware.RequireAuth, MoveRequest)
	app.Delete("/api/v1/requests/:id", middleware.RequireAuth, DeleteRequest)
	app.Post("/api/v1/requests/:id/duplicate", middleware.RequireAuth, DuplicateRequest)
}

type MoveRequestPayload struct {
	CollectionID uint    `json:"collection_id"`
	FolderID     *uint   `json:"folder_id"`
	OrderIndex   float64 `json:"order_index"`
}

func MoveRequest(c *fiber.Ctx) error {
	fmt.Println("move request")

	requestID := c.Params("id")
	var request repository.Request
	if err := repository.DB.First(&request, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}

	var collection repository.Collection
	repository.DB.First(&collection, request.CollectionID)
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var payload MoveRequestPayload
	if err := c.BodyParser(&payload); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	// If moving to a different collection, check access to target collection
	if payload.CollectionID != request.CollectionID {
		var targetCollection repository.Collection
		if err := repository.DB.First(&targetCollection, payload.CollectionID).Error; err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Target collection not found", "code": "BAD_REQUEST"})
		}
		if !isEditorOrAbove(c, targetCollection.TeamID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden to move to target collection", "code": "FORBIDDEN"})
		}
	}

	request.CollectionID = payload.CollectionID
	request.FolderID = payload.FolderID
	request.OrderIndex = payload.OrderIndex

	if err := repository.DB.Save(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to move request", "code": "INTERNAL_SERVER_ERROR"})
	}

	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	NotifyEntityUpdate(collection.TeamID, userID, "Request", request.Name, "move", map[string]interface{}{"collection_id": collection.ID, "request_id": request.ID})

	return c.JSON(request)
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

	var data map[string]interface{}
	if err := c.BodyParser(&data); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	userID := uint(c.Locals("user_id").(float64))
	fid := folder.ID

	request := repository.Request{
		Name:              getString(data, "name"),
		Description:       getString(data, "description"),
		Method:            getString(data, "method"),
		URL:               getString(data, "url"),
		BodyType:          getString(data, "body_type"),
		CollectionID:      collection.ID,
		FolderID:          &fid,
		CreatedByID:       &userID,
		OrderIndex:        getFloat64(data, "order_index"),
		PreRequestScript:  getString(data, "pre_request_script"),
		PostRequestScript: getString(data, "post_request_script"),
	}

	if v, ok := data["headers"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Headers = jsonb
		}
	}
	if v, ok := data["body"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Body = jsonb
		}
	}
	if v, ok := data["body_variants"].(map[string]interface{}); ok {
		request.BodyVariants = repository.JSONB(v)
	}
	if v, ok := data["auth_config"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.AuthConfig = jsonb
		}
	}

	if err := repository.DB.Create(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create request", "code": "INTERNAL_SERVER_ERROR"})
	}

	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "CREATED_REQUEST", "REQUEST", request.ID, map[string]interface{}{"name": request.Name})
	NotifyEntityUpdate(collection.TeamID, userID, "Request", request.Name, "create", map[string]interface{}{"collection_id": collection.ID, "request_id": request.ID})

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

	var data map[string]interface{}
	if err := c.BodyParser(&data); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	userID := uint(c.Locals("user_id").(float64))
	request := repository.Request{
		Name:              getString(data, "name"),
		Description:       getString(data, "description"),
		Method:            getString(data, "method"),
		URL:               getString(data, "url"),
		BodyType:          getString(data, "body_type"),
		CollectionID:      collection.ID,
		CreatedByID:       &userID,
		OrderIndex:        getFloat64(data, "order_index"),
		PreRequestScript:  getString(data, "pre_request_script"),
		PostRequestScript: getString(data, "post_request_script"),
	}

	if fIDVal, ok := data["folder_id"].(float64); ok {
		fid := uint(fIDVal)
		request.FolderID = &fid
	}

	if v, ok := data["headers"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Headers = jsonb
		}
	}
	if v, ok := data["body"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Body = jsonb
		}
	}
	if v, ok := data["body_variants"].(map[string]interface{}); ok {
		request.BodyVariants = repository.JSONB(v)
	}
	if v, ok := data["auth_config"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.AuthConfig = jsonb
		}
	}

	if err := repository.DB.Create(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create request", "code": "INTERNAL_SERVER_ERROR"})
	}

	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "CREATED_REQUEST", "REQUEST", request.ID, map[string]interface{}{"name": request.Name})
	NotifyEntityUpdate(collection.TeamID, userID, "Request", request.Name, "create", map[string]interface{}{"collection_id": collection.ID, "request_id": request.ID})

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
	if v, ok := updateData["headers"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Headers = jsonb
		}
	}
	if v, ok := updateData["body"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.Body = jsonb
		}
	}
	if bodyType, ok := updateData["body_type"].(string); ok {
		request.BodyType = bodyType
	}
	if v, ok := updateData["body_variants"].(map[string]interface{}); ok {
		request.BodyVariants = repository.JSONB(v)
	}
	if v, ok := updateData["auth_config"]; ok {
		if jsonb, ok := toJSONB(v); ok {
			request.AuthConfig = jsonb
		}
	}
	if pre, ok := updateData["pre_request_script"].(string); ok {
		request.PreRequestScript = pre
	}
	if post, ok := updateData["post_request_script"].(string); ok {
		request.PostRequestScript = post
	}
	// field_validations: simpan data validasi per field (header/body)
	if fv, ok := updateData["field_validations"]; ok {
		if fvMap, ok := fv.(map[string]interface{}); ok {
			request.FieldValidations = repository.JSONB(fvMap)
		}
	}

	if err := repository.DB.Save(&request).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update request", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "REQUEST", request.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "UPDATED_REQUEST", "REQUEST", request.ID, nil)
	NotifyEntityUpdate(collection.TeamID, userID, "Request", request.Name, "update", map[string]interface{}{"collection_id": collection.ID, "request_id": request.ID})

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
	NotifyEntityUpdate(collection.TeamID, userID, "Request", request.Name, "delete", map[string]interface{}{"collection_id": collection.ID})

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
		BodyVariants:      original.BodyVariants,
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
	NotifyEntityUpdate(collection.TeamID, userID, "Request", newRequest.Name, "create", map[string]interface{}{"collection_id": collection.ID, "request_id": newRequest.ID})

	return c.Status(fiber.StatusCreated).JSON(newRequest)
}

// Helpers
// toJSONB safely converts an interface{} value to JSONB.
// Handles map, array, and string (raw body) cases without panicking.
func toJSONB(v interface{}) (repository.JSONB, bool) {
	if v == nil {
		return nil, false
	}
	switch val := v.(type) {
	case map[string]interface{}:
		return repository.JSONB(val), true
	case []interface{}:
		return repository.JSONB{"array": val}, true
	case string:
		return repository.JSONB{"raw": val}, true
	}
	return nil, false
}

func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if val, ok := m[key].(float64); ok {
		return int(val)
	}
	return 0
}

func getFloat64(m map[string]interface{}, key string) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return 0
}
