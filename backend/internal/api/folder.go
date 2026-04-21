package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapify-backend/internal/middleware"
	"github.com/waluyo/wapify-backend/internal/repository"
)

type CreateFolderRequest struct {
	Name           string `json:"name"`
	ParentFolderID *uint  `json:"parent_folder_id"`
	OrderIndex     int    `json:"order_index"`
}

func SetupFolderRoutes(app *fiber.App) {
	app.Get("/api/v1/collections/:id/folders", middleware.RequireAuth, ListFolders)
	app.Post("/api/v1/collections/:id/folders", middleware.RequireAuth, CreateFolder)
	app.Put("/api/v1/folders/:id", middleware.RequireAuth, UpdateFolder)
	app.Delete("/api/v1/folders/:id", middleware.RequireAuth, DeleteFolder)
}

func getCollectionAndCheckAccess(c *fiber.Ctx, collectionID interface{}) (*repository.Collection, error) {
	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return nil, err
	}
	return &collection, nil
}

func ListFolders(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	collection, err := getCollectionAndCheckAccess(c, collectionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var folders []repository.Folder
	repository.DB.Where("collection_id = ?", collectionID).Find(&folders)
	return c.JSON(folders)
}

func CreateFolder(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	collection, err := getCollectionAndCheckAccess(c, collectionID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}
	var req CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	folder := repository.Folder{
		Name:           req.Name,
		CollectionID:   collection.ID,
		ParentFolderID: req.ParentFolderID,
		OrderIndex:     req.OrderIndex,
	}
	if err := repository.DB.Create(&folder).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create folder", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "CREATED_FOLDER", "FOLDER", folder.ID, map[string]interface{}{"name": folder.Name})

	return c.Status(fiber.StatusCreated).JSON(folder)
}

func UpdateFolder(c *fiber.Ctx) error {
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
	var req CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	if req.Name != "" {
		folder.Name = req.Name
	}
	if err := repository.DB.Save(&folder).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update folder", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "UPDATED_FOLDER", "FOLDER", folder.ID, nil)

	return c.JSON(folder)
}

func DeleteFolder(c *fiber.Ctx) error {
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
	if err := repository.DB.Delete(&folder).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete folder", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	userID := uint(c.Locals("user_id").(float64))
	WSHub.BroadcastEntityUpdate(collection.TeamID, "COLLECTION", collection.ID)
	LogActivity(repository.DB, collection.TeamID, userID, "DELETED_FOLDER", "FOLDER", folder.ID, map[string]interface{}{"name": folder.Name})

	return c.JSON(fiber.Map{"message": "Folder deleted successfully"})
}
