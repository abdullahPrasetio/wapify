package api

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func SetupNotificationRoutes(app *fiber.App) {
	notifGroup := app.Group("/api/v1/notifications")
	notifGroup.Use(middleware.RequireAuth)

	notifGroup.Get("/", ListNotifications)
	notifGroup.Patch("/:id/read", MarkNotificationRead)
	notifGroup.Post("/read-all", MarkAllNotificationsRead)
	notifGroup.Delete("/", DeleteAllNotifications)
}

func ListNotifications(c *fiber.Ctx) error {
	userId := c.Locals("user_id").(float64)
	var notifications []repository.Notification

	if err := repository.DB.Preload("Sender").
		Where("user_id = ?", uint(userId)).
		Order("created_at DESC").
		Limit(100).
		Find(&notifications).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch notifications", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(notifications)
}

func DeleteAllNotifications(c *fiber.Ctx) error {
	userId := c.Locals("user_id").(float64)

	if err := repository.DB.Where("user_id = ?", uint(userId)).
		Delete(&repository.Notification{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete notifications", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.SendStatus(fiber.StatusOK)
}

func CleanupOldNotifications() {
	// Jalankan sekali saat startup
	runCleanup()

	// Lalu jalankan secara periodik setiap 24 jam
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			runCleanup()
		}
	}()
}

func runCleanup() {
	log.Println("Notification Cleanup: Starting periodic task...")
	result := repository.DB.Where("created_at < NOW() - INTERVAL '30 days'").
		Delete(&repository.Notification{})
	
	if result.Error != nil {
		log.Printf("Notification Cleanup Error: %v", result.Error)
	} else if result.RowsAffected > 0 {
		log.Printf("Notification Cleanup: Deleted %d notifications older than 30 days", result.RowsAffected)
	}
}

func MarkNotificationRead(c *fiber.Ctx) error {
	id := c.Params("id")
	userId := c.Locals("user_id").(float64)

	if err := repository.DB.Model(&repository.Notification{}).
		Where("id = ? AND user_id = ?", id, uint(userId)).
		Update("is_read", true).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update notification", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.SendStatus(fiber.StatusOK)
}

func MarkAllNotificationsRead(c *fiber.Ctx) error {
	userId := c.Locals("user_id").(float64)

	if err := repository.DB.Model(&repository.Notification{}).
		Where("user_id = ?", uint(userId)).
		Update("is_read", true).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update notifications", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.SendStatus(fiber.StatusOK)
}

// CreateNotification is a helper to create and broadcast a notification
func CreateNotification(userID uint, senderID uint, nType string, title string, message string, metadata map[string]interface{}) {
	var metaJSON repository.JSONB
	if metadata != nil {
		b, _ := json.Marshal(metadata)
		json.Unmarshal(b, &metaJSON)
	} else {
		metaJSON = repository.JSONB{}
	}

	notification := repository.Notification{
		UserID:   userID,
		SenderID: senderID,
		Type:     nType,
		Title:    title,
		Message:  message,
		Metadata: metaJSON,
	}

	if err := repository.DB.Create(&notification).Error; err != nil {
		log.Printf("Error creating notification: %v", err)
		return
	}

	log.Printf("Notification created: ID=%d, UserID=%d, Type=%s", notification.ID, userID, nType)

	// Fetch sender info for websocket payload
	repository.DB.Model(&notification).Preload("Sender").First(&notification)

	// Broadcast via WS
	WSHub.BroadcastNotification(userID, notification)
}

// NotifyTeamMembers triggers notifications for all members of a team except the sender
func NotifyTeamMembers(teamID uint, senderID uint, nType string, title string, message string, metadata map[string]interface{}) {
	var members []repository.TeamMember
	if err := repository.DB.Where("team_id = ? AND user_id != ?", teamID, senderID).Find(&members).Error; err != nil {
		log.Printf("Error fetching team members for notification: %v", err)
		return
	}

	log.Printf("Notifying %d team members for team %d (excluding sender %d)", len(members), teamID, senderID)
	for _, member := range members {
		CreateNotification(member.UserID, senderID, nType, title, message, metadata)
	}
}

// NotifyEntityUpdate helper to notify about entity changes
func NotifyEntityUpdate(teamID uint, senderID uint, entityType string, entityName string, action string, metadata map[string]interface{}) {
	title := "Update Workspace"
	message := fmt.Sprintf("Anggota tim %s %s %s", action, entityType, entityName)
	
	if action == "update" {
		message = fmt.Sprintf("Mengupdate %s: %s", entityType, entityName)
	} else if action == "delete" {
		message = fmt.Sprintf("Menghapus %s: %s", entityType, entityName)
	} else if action == "create" {
		message = fmt.Sprintf("Menambahkan %s baru: %s", entityType, entityName)
	} else if action == "move" {
		message = fmt.Sprintf("Memindahkan %s: %s", entityType, entityName)
	}

	NotifyTeamMembers(teamID, senderID, "ENTITY_"+action, title, message, metadata)
}
