package api

import (
	"encoding/json"
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"gorm.io/gorm"
)

type CreateCollectionRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Postman Collection Structs (simplified v2.1)
type PostmanCollection struct {
	Info struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"info"`
	Item []PostmanItem `json:"item"`
}

type PostmanItem struct {
	Name    string        `json:"name"`
	Item    []PostmanItem `json:"item,omitempty"` // for folders
	Request *PostmanReq   `json:"request,omitempty"`
}

type PostmanReq struct {
	Method string `json:"method"`
	URL    interface{} `json:"url"` // can be string or object
	Header []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"header"`
	Body *struct {
		Mode string `json:"mode"`
		Raw  string `json:"raw"`
	} `json:"body"`
}

func SetupCollectionRoutes(app *fiber.App) {
	// Team-scoped collections
	app.Get("/api/v1/teams/:id/collections", middleware.RequireAuth, ListCollections)
	app.Post("/api/v1/teams/:id/collections", middleware.RequireAuth, CreateCollection)
	app.Post("/api/v1/teams/:id/import", middleware.RequireAuth, ImportPostman)

	// Collection CRUD
	app.Get("/api/v1/collections/:id", middleware.RequireAuth, GetCollection)
	app.Put("/api/v1/collections/:id", middleware.RequireAuth, UpdateCollection)
	app.Delete("/api/v1/collections/:id", middleware.RequireAuth, DeleteCollection)
}

func ImportPostman(c *fiber.Ctx) error {
	teamID := c.Params("id")
	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var postman PostmanCollection
	if err := c.BodyParser(&postman); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Postman JSON", "code": "BAD_REQUEST"})
	}

	userID := uint(c.Locals("user_id").(float64))
	tid := parseUint(teamID)

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Create Collection
		collection := repository.Collection{
			Name:        postman.Info.Name,
			Description: postman.Info.Description,
			TeamID:      tid,
			CreatedByID: &userID,
		}
		if err := tx.Create(&collection).Error; err != nil {
			return err
		}

		// 2. Process Items recursively
		return processPostmanItems(tx, postman.Item, collection.ID, nil, userID)
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error(), "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast
	WSHub.BroadcastEntityUpdate(tid, "TEAM", tid)
	LogActivity(repository.DB, tid, userID, "IMPORTED_POSTMAN", "TEAM", tid, map[string]interface{}{"collection_name": postman.Info.Name})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Import successful"})
}

func processPostmanItems(tx *gorm.DB, items []PostmanItem, collectionID uint, folderID *uint, userID uint) error {
	for _, item := range items {
		if item.Item != nil {
			// It's a folder
			folder := repository.Folder{
				Name:           item.Name,
				CollectionID:   collectionID,
				ParentFolderID: folderID,
			}
			if err := tx.Create(&folder).Error; err != nil {
				return err
			}
			if err := processPostmanItems(tx, item.Item, collectionID, &folder.ID, userID); err != nil {
				return err
			}
		} else if item.Request != nil {
			// It's a request
			headers := repository.JSONB{}
			for _, h := range item.Request.Header {
				headers[h.Key] = h.Value
			}

			var body map[string]interface{}
			if item.Request.Body != nil && item.Request.Body.Mode == "raw" {
				json.Unmarshal([]byte(item.Request.Body.Raw), &body)
			}

			// Handle URL (can be string or object)
			urlStr := ""
			switch v := item.Request.URL.(type) {
			case string:
				urlStr = v
			case map[string]interface{}:
				if raw, ok := v["raw"].(string); ok {
					urlStr = raw
				}
			}

			request := repository.Request{
				Name:         item.Name,
				CollectionID: collectionID,
				FolderID:     folderID,
				Method:       item.Request.Method,
				URL:          urlStr,
				Headers:      headers,
				Body:         body,
				CreatedByID:  &userID,
				AuthConfig:   repository.JSONB{"type": "No Auth"},
			}
			if err := tx.Create(&request).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func ListCollections(c *fiber.Ctx) error {
	teamID := c.Params("id")

	if !canAccessTeam(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var collections []repository.Collection
	if err := repository.DB.Where("team_id = ?", teamID).Find(&collections).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch collections", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(collections)
}

func CreateCollection(c *fiber.Ctx) error {
	teamID := c.Params("id")

	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req CreateCollectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	userID := uint(c.Locals("user_id").(float64))
	tid := parseUint(teamID)

	collection := repository.Collection{
		Name:        req.Name,
		Description: req.Description,
		TeamID:      tid,
		CreatedByID: &userID,
	}

	if err := repository.DB.Create(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	WSHub.BroadcastEntityUpdate(tid, "TEAM", tid)
	LogActivity(repository.DB, tid, userID, "CREATED_COLLECTION", "COLLECTION", collection.ID, map[string]interface{}{"name": collection.Name})
	NotifyEntityUpdate(tid, userID, "Collection", collection.Name, "create", map[string]interface{}{"collection_id": collection.ID})

	return c.Status(fiber.StatusCreated).JSON(collection)
}

func GetCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	// Include folders and root requests
	var folders []repository.Folder
	var requests []repository.Request
	repository.DB.Where("collection_id = ? AND parent_folder_id IS NULL", collection.ID).Find(&folders)
	repository.DB.Where("collection_id = ? AND folder_id IS NULL", collection.ID).Find(&requests)

	return c.JSON(fiber.Map{
		"collection": collection,
		"folders":    folders,
		"requests":   requests,
	})
}

func UpdateCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req CreateCollectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}

	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Description != "" {
		collection.Description = req.Description
	}

	if err := repository.DB.Save(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "TEAM", collection.TeamID)
	LogActivity(repository.DB, collection.TeamID, userID, "UPDATED_COLLECTION", "COLLECTION", collection.ID, nil)
	NotifyEntityUpdate(collection.TeamID, userID, "Collection", collection.Name, "update", map[string]interface{}{"collection_id": collection.ID})

	return c.JSON(collection)
}

func DeleteCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	if err := repository.DB.Delete(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "TEAM", collection.TeamID)
	LogActivity(repository.DB, collection.TeamID, userID, "DELETED_COLLECTION", "COLLECTION", collection.ID, map[string]interface{}{"name": collection.Name})
	NotifyEntityUpdate(collection.TeamID, userID, "Collection", collection.Name, "delete", map[string]interface{}{"collection_id": collection.ID})

	return c.JSON(fiber.Map{"message": "Collection deleted successfully"})
}
