package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"gorm.io/gorm"
)

// chaosModeCache caches per-collection chaos_mode for 5 seconds to avoid a DB hit per mock request.
type chaosCacheEntry struct {
	value   bool
	expires time.Time
}

var (
	chaosCacheMu sync.Mutex
	chaosCache   = make(map[uint]chaosCacheEntry)
)

func getChaosMode(collectionID uint) bool {
	chaosCacheMu.Lock()
	entry, ok := chaosCache[collectionID]
	chaosCacheMu.Unlock()
	if ok && time.Now().Before(entry.expires) {
		return entry.value
	}
	var col repository.Collection
	if err := repository.DB.Select("chaos_mode").First(&col, collectionID).Error; err != nil {
		return false
	}
	chaosCacheMu.Lock()
	chaosCache[collectionID] = chaosCacheEntry{value: col.ChaosMode, expires: time.Now().Add(5 * time.Second)}
	chaosCacheMu.Unlock()
	return col.ChaosMode
}

func invalidateChaosCache(collectionID uint) {
	chaosCacheMu.Lock()
	delete(chaosCache, collectionID)
	chaosCacheMu.Unlock()
}

// SetupMockServerRoutes registers mock server endpoints
func SetupMockServerRoutes(app *fiber.App) {
	// 1. Management API for Collections (protected via JWT)
	colMock := app.Group("/api/v1/collections/:id/mock", mockAuthMiddleware)
	colMock.Get("/endpoints", listMockEndpoints)
	colMock.Post("/endpoints", createMockEndpoint)
	colMock.Put("/endpoints/:endpointId", updateMockEndpoint)
	colMock.Delete("/endpoints/:endpointId", deleteMockEndpoint)
	colMock.Post("/endpoints/:endpointId/from-request/:requestId", createMockFromRequest)
	colMock.Patch("/endpoints/:endpointId/mode", updateMockMode)
	colMock.Post("/generate-from-collection", generateMocksFromCollection)
	colMock.Patch("/chaos", updateCollectionChaosMode)
	colMock.Get("/logs", listMockRequestLogs)

	// 2. Management API for Standalone/Workspace (protected via JWT)
	teamMock := app.Group("/api/v1/workspaces/:teamId/mock", mockAuthMiddleware)
	teamMock.Get("/endpoints", listStandaloneEndpoints)
	teamMock.Post("/endpoints", createStandaloneEndpoint)
	teamMock.Put("/endpoints/:endpointId", updateStandaloneMockEndpoint)
	teamMock.Delete("/endpoints/:endpointId", deleteMockEndpoint)
	teamMock.Patch("/endpoints/:endpointId/mode", updateMockMode)
	teamMock.Post("/endpoints/:endpointId/transfer", transferStandaloneMock)
	teamMock.Post("/endpoints/transfer-bulk", bulkTransferStandaloneMocks)

	// 3b. Universal single-endpoint transfer (collection ↔ standalone, cross-team)
	app.Post("/api/v1/mock/endpoints/:endpointId/transfer", mockAuthMiddleware, transferMockEndpoint)

	// 3. Scenario CRUD (Universal)
	app.Get("/api/v1/mock-endpoints/:endpointId/scenarios", mockAuthMiddleware, listMockScenarios)
	app.Post("/api/v1/mock-endpoints/:endpointId/scenarios", mockAuthMiddleware, createMockScenario)
	app.Put("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", mockAuthMiddleware, updateMockScenario)
	app.Delete("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", mockAuthMiddleware, deleteMockScenario)
	app.Patch("/api/v1/mock-endpoints/:endpointId/scenarios/reorder", mockAuthMiddleware, reorderScenarios)
	app.Patch("/api/v1/mock-endpoints/:endpointId/mode", mockAuthMiddleware, updateMockMode)

	// 4. The actual mock engine
	// Matches: /mock/w/:team_id/*
	app.All("/mock/w/:team_id/*", handleStandaloneMockRequest)
	// Matches: /mock/:collection_id/*
	app.All("/mock/:collection_id/*", handleMockRequest)
}

// mockAuthMiddleware validates JWT for management endpoints
func mockAuthMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized", "code": "UNAUTHORIZED"})
	}
	tokenString := strings.TrimPrefix(authHeader, "Bearer ")

	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token", "code": "INVALID_TOKEN"})
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid claims", "code": "INVALID_TOKEN"})
	}
	c.Locals("user_id", claims["user_id"])
	c.Locals("is_super_admin", claims["is_super_admin"])
	return c.Next()
}

// ─── Management Handlers ──────────────────────────────────────────────────────

func listMockEndpoints(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var endpoints []repository.MockEndpoint
	repository.DB.Where("collection_id = ?", collectionID).Order("id asc").Find(&endpoints)
	return c.JSON(endpoints)
}

type createMockEndpointInput struct {
	Name            string                 `json:"name"`
	Method          string                 `json:"method"`
	Path            string                 `json:"path"`
	StatusCode      int                    `json:"status_code"`
	ResponseHeaders map[string]interface{} `json:"response_headers"`
	ResponseBody    string                 `json:"response_body"`
	DelayMs         int                    `json:"delay_ms"`
	DelayMaxMs      int                    `json:"delay_max_ms"`
	ErrorRate       int                    `json:"error_rate"`
	ErrorStatusCode int                    `json:"error_status_code"`
	IsActive        *bool                  `json:"is_active"`
	CollectionID    *uint                  `json:"collection_id"`
}

func createMockEndpoint(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input createMockEndpointInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	if input.Method == "" || input.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "method and path are required", "code": "VALIDATION_ERROR"})
	}
	if input.StatusCode == 0 {
		input.StatusCode = 200
	}

	colID := col.ID
	errStatus := input.ErrorStatusCode
	if errStatus == 0 {
		errStatus = 500
	}
	endpoint := repository.MockEndpoint{
		CollectionID:    &colID,
		Method:          strings.ToUpper(input.Method),
		Path:            normalizePath(input.Path),
		StatusCode:      input.StatusCode,
		ResponseHeaders: repository.JSONB(input.ResponseHeaders),
		ResponseBody:    input.ResponseBody,
		DelayMs:         input.DelayMs,
		DelayMaxMs:      input.DelayMaxMs,
		ErrorRate:       input.ErrorRate,
		ErrorStatusCode: errStatus,
		IsActive:        true,
	}

	if err := repository.DB.Create(&endpoint).Error; err != nil {
		log.Error().Err(err).Msg("Failed to create mock endpoint")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create endpoint", "code": "DB_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(endpoint)
}

func updateMockEndpoint(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	endpointID := c.Params("endpointId")

	var endpoint repository.MockEndpoint
	if err := repository.DB.First(&endpoint, endpointID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint not found", "code": "NOT_FOUND"})
	}

	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input createMockEndpointInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	if input.Name != "" {
		endpoint.Name = input.Name
	}
	if input.Method != "" {
		endpoint.Method = strings.ToUpper(input.Method)
	}
	if input.Path != "" {
		endpoint.Path = normalizePath(input.Path)
	}
	if input.StatusCode > 0 {
		endpoint.StatusCode = input.StatusCode
	}
	endpoint.ResponseBody = input.ResponseBody
	if input.ResponseHeaders != nil {
		endpoint.ResponseHeaders = repository.JSONB(input.ResponseHeaders)
	}
	if input.IsActive != nil {
		endpoint.IsActive = *input.IsActive
	}
	endpoint.DelayMs = input.DelayMs
	endpoint.DelayMaxMs = input.DelayMaxMs
	endpoint.ErrorRate = input.ErrorRate
	if input.ErrorStatusCode > 0 {
		endpoint.ErrorStatusCode = input.ErrorStatusCode
	}
	endpoint.UpdatedAt = time.Now()

	if err := repository.DB.Save(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update", "code": "DB_ERROR"})
	}

	return c.JSON(endpoint)
}

func updateStandaloneMockEndpoint(c *fiber.Ctx) error {
	teamID := uint(parseUint(c.Params("teamId")))
	endpointID := c.Params("endpointId")

	var endpoint repository.MockEndpoint
	if err := repository.DB.First(&endpoint, endpointID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, teamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input createMockEndpointInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	if input.Name != "" {
		endpoint.Name = input.Name
	}
	if input.Method != "" {
		endpoint.Method = strings.ToUpper(input.Method)
	}
	if input.Path != "" {
		endpoint.Path = normalizePath(input.Path)
	}
	if input.StatusCode > 0 {
		endpoint.StatusCode = input.StatusCode
	}
	endpoint.ResponseBody = input.ResponseBody
	if input.ResponseHeaders != nil {
		endpoint.ResponseHeaders = repository.JSONB(input.ResponseHeaders)
	}
	if input.IsActive != nil {
		endpoint.IsActive = *input.IsActive
	}
	endpoint.DelayMs = input.DelayMs
	endpoint.DelayMaxMs = input.DelayMaxMs
	endpoint.ErrorRate = input.ErrorRate
	if input.ErrorStatusCode > 0 {
		endpoint.ErrorStatusCode = input.ErrorStatusCode
	}
	endpoint.UpdatedAt = time.Now()

	if err := repository.DB.Save(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update", "code": "DB_ERROR"})
	}

	return c.JSON(endpoint)
}

type transferMockInput struct {
	CollectionID uint   `json:"collection_id"`
	Mode         string `json:"mode"` // "copy" or "move"
}

func transferStandaloneMock(c *fiber.Ctx) error {
	teamID := uint(parseUint(c.Params("teamId")))
	endpointID := c.Params("endpointId")

	if !canAccessTeam(c, teamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input transferMockInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}
	if input.CollectionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "collection_id is required", "code": "VALIDATION_ERROR"})
	}
	if input.Mode != "copy" && input.Mode != "move" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "mode must be 'copy' or 'move'", "code": "VALIDATION_ERROR"})
	}

	var col repository.Collection
	if err := repository.DB.First(&col, input.CollectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var src repository.MockEndpoint
	if err := repository.DB.Preload("Scenarios").First(&src, endpointID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint not found", "code": "NOT_FOUND"})
	}

	var newEndpoint repository.MockEndpoint

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		colID := input.CollectionID
		newEndpoint = repository.MockEndpoint{
			Name:            src.Name,
			CollectionID:    &colID,
			TeamID:          nil,
			Method:          src.Method,
			Path:            src.Path,
			StatusCode:      src.StatusCode,
			ResponseHeaders: src.ResponseHeaders,
			ResponseBody:    src.ResponseBody,
			DelayMs:         src.DelayMs,
			IsActive:        src.IsActive,
			EvaluationMode:  src.EvaluationMode,
		}
		if err := tx.Create(&newEndpoint).Error; err != nil {
			return err
		}

		// Copy scenarios
		for _, s := range src.Scenarios {
			scenario := repository.MockScenario{
				MockEndpointID:  newEndpoint.ID,
				Name:            s.Name,
				StatusCode:      s.StatusCode,
				ResponseHeaders: s.ResponseHeaders,
				ResponseBody:    s.ResponseBody,
				Conditions:      s.Conditions,
				ResponseType:    s.ResponseType,
				FileName:        s.FileName,
				FileBase64:      s.FileBase64,
				IsDefault:       s.IsDefault,
				OrderIndex:      s.OrderIndex,
			}
			if err := tx.Create(&scenario).Error; err != nil {
				return err
			}
		}

		if input.Mode == "move" {
			return tx.Delete(&repository.MockEndpoint{}, src.ID).Error
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error(), "code": "DB_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(newEndpoint)
}

// transferMockEndpoint is a universal handler: standalone↔collection, cross-team, cross-collection
type universalTransferInput struct {
	TargetType string `json:"target_type"` // "standalone" or "collection"
	TargetID   uint   `json:"target_id"`   // team_id if standalone, collection_id if collection
	Mode       string `json:"mode"`        // "copy" or "move"
}

func transferMockEndpoint(c *fiber.Ctx) error {
	endpointID := c.Params("endpointId")

	var input universalTransferInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}
	if input.TargetType != "standalone" && input.TargetType != "collection" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "target_type must be 'standalone' or 'collection'", "code": "VALIDATION_ERROR"})
	}
	if input.TargetID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "target_id is required", "code": "VALIDATION_ERROR"})
	}
	if input.Mode != "copy" && input.Mode != "move" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "mode must be 'copy' or 'move'", "code": "VALIDATION_ERROR"})
	}

	if input.TargetType == "collection" {
		var col repository.Collection
		if err := repository.DB.First(&col, input.TargetID).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
		}
		if !canAccessTeam(c, col.TeamID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
		}
	} else {
		if !canAccessTeam(c, input.TargetID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
		}
	}

	var src repository.MockEndpoint
	if err := repository.DB.Preload("Scenarios").First(&src, endpointID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint not found", "code": "NOT_FOUND"})
	}

	var newEndpoint repository.MockEndpoint
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		newEndpoint = repository.MockEndpoint{
			Name:           src.Name,
			Method:         src.Method,
			Path:           src.Path,
			StatusCode:     src.StatusCode,
			ResponseHeaders: src.ResponseHeaders,
			ResponseBody:   src.ResponseBody,
			DelayMs:        src.DelayMs,
			IsActive:       src.IsActive,
			EvaluationMode: src.EvaluationMode,
		}
		if input.TargetType == "collection" {
			colID := input.TargetID
			newEndpoint.CollectionID = &colID
			newEndpoint.TeamID = nil
		} else {
			tid := input.TargetID
			newEndpoint.TeamID = &tid
			newEndpoint.CollectionID = nil
		}
		if err := tx.Create(&newEndpoint).Error; err != nil {
			return err
		}
		for _, s := range src.Scenarios {
			scenario := repository.MockScenario{
				MockEndpointID:  newEndpoint.ID,
				Name:            s.Name,
				StatusCode:      s.StatusCode,
				ResponseHeaders: s.ResponseHeaders,
				ResponseBody:    s.ResponseBody,
				Conditions:      s.Conditions,
				ResponseType:    s.ResponseType,
				FileName:        s.FileName,
				FileBase64:      s.FileBase64,
				IsDefault:       s.IsDefault,
				OrderIndex:      s.OrderIndex,
			}
			if err := tx.Create(&scenario).Error; err != nil {
				return err
			}
		}
		if input.Mode == "move" {
			if err := tx.Where("mock_endpoint_id = ?", src.ID).Delete(&repository.MockScenario{}).Error; err != nil {
				return err
			}
			return tx.Delete(&repository.MockEndpoint{}, src.ID).Error
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error(), "code": "DB_ERROR"})
	}
	return c.Status(fiber.StatusCreated).JSON(newEndpoint)
}

type bulkTransferInput struct {
	EndpointIDs []uint `json:"endpoint_ids"` // empty = all standalone in team
	TargetType  string `json:"target_type"`  // "standalone" or "collection"
	TargetID    uint   `json:"target_id"`
	Mode        string `json:"mode"` // "copy" or "move"
}

func bulkTransferStandaloneMocks(c *fiber.Ctx) error {
	teamID := uint(parseUint(c.Params("teamId")))
	if !canAccessTeam(c, teamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input bulkTransferInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}
	if input.TargetType != "standalone" && input.TargetType != "collection" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid target_type", "code": "VALIDATION_ERROR"})
	}
	if input.TargetID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "target_id is required", "code": "VALIDATION_ERROR"})
	}
	if input.Mode != "copy" && input.Mode != "move" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "mode must be 'copy' or 'move'", "code": "VALIDATION_ERROR"})
	}

	if input.TargetType == "collection" {
		var col repository.Collection
		if err := repository.DB.First(&col, input.TargetID).Error; err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
		}
		if !canAccessTeam(c, col.TeamID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
		}
	} else {
		if !canAccessTeam(c, input.TargetID) {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
		}
	}

	var endpoints []repository.MockEndpoint
	query := repository.DB.Preload("Scenarios").Where("team_id = ? AND collection_id IS NULL", teamID)
	if len(input.EndpointIDs) > 0 {
		query = query.Where("id IN ?", input.EndpointIDs)
	}
	query.Find(&endpoints)

	if len(endpoints) == 0 {
		return c.JSON(fiber.Map{"message": "No endpoints to transfer", "count": 0})
	}

	count := 0
	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		for _, src := range endpoints {
			newEp := repository.MockEndpoint{
				Name:           src.Name,
				Method:         src.Method,
				Path:           src.Path,
				StatusCode:     src.StatusCode,
				ResponseHeaders: src.ResponseHeaders,
				ResponseBody:   src.ResponseBody,
				DelayMs:        src.DelayMs,
				IsActive:       src.IsActive,
				EvaluationMode: src.EvaluationMode,
			}
			if input.TargetType == "collection" {
				colID := input.TargetID
				newEp.CollectionID = &colID
				newEp.TeamID = nil
			} else {
				tid := input.TargetID
				newEp.TeamID = &tid
				newEp.CollectionID = nil
			}
			if err := tx.Create(&newEp).Error; err != nil {
				return err
			}
			for _, s := range src.Scenarios {
				scenario := repository.MockScenario{
					MockEndpointID:  newEp.ID,
					Name:            s.Name,
					StatusCode:      s.StatusCode,
					ResponseHeaders: s.ResponseHeaders,
					ResponseBody:    s.ResponseBody,
					Conditions:      s.Conditions,
					ResponseType:    s.ResponseType,
					FileName:        s.FileName,
					FileBase64:      s.FileBase64,
					IsDefault:       s.IsDefault,
					OrderIndex:      s.OrderIndex,
				}
				if err := tx.Create(&scenario).Error; err != nil {
					return err
				}
			}
			count++
		}
		if input.Mode == "move" {
			ids := make([]uint, len(endpoints))
			for i, e := range endpoints {
				ids[i] = e.ID
			}
			if err := tx.Where("mock_endpoint_id IN ?", ids).Delete(&repository.MockScenario{}).Error; err != nil {
				return err
			}
			return tx.Where("id IN ?", ids).Delete(&repository.MockEndpoint{}).Error
		}
		return nil
	})

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error(), "code": "DB_ERROR"})
	}
	return c.JSON(fiber.Map{"message": fmt.Sprintf("Transferred %d endpoints", count), "count": count})
}

func deleteMockEndpoint(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	endpointID := c.Params("endpointId")

	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	if err := repository.DB.Delete(&repository.MockEndpoint{}, endpointID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete", "code": "DB_ERROR"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

// createMockFromRequest creates a mock endpoint from an existing request (quick-setup)
func createMockFromRequest(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	requestID := c.Params("requestId")

	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req repository.Request
	if err := repository.DB.First(&req, requestID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Request not found", "code": "NOT_FOUND"})
	}

	reqID := req.ID
	colID := col.ID

	// Extract path from URL
	urlPath := extractURLPath(req.URL)

	endpoint := repository.MockEndpoint{
		CollectionID: &colID,
		RequestID:    &reqID,
		Method:       req.Method,
		Path:         urlPath,
		StatusCode:   200,
		ResponseHeaders: repository.JSONB{
			"Content-Type": "application/json",
		},
		ResponseBody: `{"message": "Mock response for ` + req.Name + `"}`,
		DelayMs:      0,
		IsActive:     true,
	}

	if err := repository.DB.Create(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create mock", "code": "DB_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(endpoint)
}

func updateMockMode(c *fiber.Ctx) error {
	endpointID := c.Params("endpointId")
	var input struct {
		EvaluationMode   string `json:"evaluation_mode"`
		ActiveScenarioID *uint  `json:"active_scenario_id"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	var endpoint repository.MockEndpoint
	if err := repository.DB.First(&endpoint, endpointID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Endpoint not found", "code": "NOT_FOUND"})
	}

	if input.EvaluationMode != "" {
		endpoint.EvaluationMode = input.EvaluationMode
	}
	endpoint.ActiveScenarioID = input.ActiveScenarioID
	endpoint.UpdatedAt = time.Now()

	if err := repository.DB.Save(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error", "code": "DB_ERROR"})
	}

	return c.JSON(fiber.Map{"message": "Mode updated"})
}

// --- Scenario Handlers ---

func listMockScenarios(c *fiber.Ctx) error {
	endpointID := c.Params("endpointId")
	var scenarios []repository.MockScenario
	repository.DB.Where("mock_endpoint_id = ?", endpointID).Order("order_index asc, id asc").Find(&scenarios)
	return c.JSON(scenarios)
}

type mockScenarioInput struct {
	Name            string                 `json:"name"`
	StatusCode      int                    `json:"status_code"`
	ResponseHeaders map[string]interface{} `json:"response_headers"`
	ResponseBody    string                 `json:"response_body"`
	Conditions      []interface{}          `json:"conditions"`
	ResponseType    string                 `json:"response_type"`
	FileName        string                 `json:"file_name"`
	FileBase64      string                 `json:"file_base64"`
	IsDefault       bool                   `json:"is_default"`
	OrderIndex      float64                `json:"order_index"`
}

func createMockScenario(c *fiber.Ctx) error {
	endpointID := c.Params("endpointId")
	var input mockScenarioInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	epID := uint(parseUint(endpointID))

	scenario := repository.MockScenario{
		MockEndpointID:  epID,
		Name:            input.Name,
		StatusCode:      input.StatusCode,
		ResponseHeaders: repository.JSONB(input.ResponseHeaders),
		ResponseBody:    input.ResponseBody,
		Conditions:      repository.JSONBArray(input.Conditions),
		ResponseType:    input.ResponseType,
		FileName:        input.FileName,
		FileBase64:      input.FileBase64,
		IsDefault:       input.IsDefault,
		OrderIndex:      input.OrderIndex,
	}

	tx := repository.DB.Begin()

	if scenario.IsDefault {
		tx.Model(&repository.MockScenario{}).
			Where("mock_endpoint_id = ?", epID).
			Update("is_default", false)
	}

	if err := tx.Create(&scenario).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error", "code": "DB_ERROR"})
	}

	tx.Commit()
	return c.Status(fiber.StatusCreated).JSON(scenario)
}

func updateMockScenario(c *fiber.Ctx) error {
	scenarioID := c.Params("scenarioId")
	if scenarioID == "" || scenarioID == "undefined" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid scenario ID", "code": "INVALID_ID"})
	}

	var input mockScenarioInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	var scenario repository.MockScenario
	if err := repository.DB.First(&scenario, "id = ?", scenarioID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Scenario not found"})
	}

	scenario.Name = input.Name
	scenario.StatusCode = input.StatusCode
	scenario.ResponseHeaders = repository.JSONB(input.ResponseHeaders)
	scenario.ResponseBody = input.ResponseBody
	scenario.Conditions = repository.JSONBArray(input.Conditions)
	scenario.ResponseType = input.ResponseType
	scenario.FileName = input.FileName
	scenario.FileBase64 = input.FileBase64
	scenario.IsDefault = input.IsDefault
	scenario.OrderIndex = input.OrderIndex
	scenario.UpdatedAt = time.Now()

	tx := repository.DB.Begin()

	if scenario.IsDefault {
		if err := tx.Model(&repository.MockScenario{}).
			Where("mock_endpoint_id = ? AND id <> ?", scenario.MockEndpointID, scenario.ID).
			Update("is_default", false).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error"})
		}
	}

	if err := tx.Save(&scenario).Error; err != nil {
		tx.Rollback()
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error", "code": "DB_ERROR"})
	}

	tx.Commit()
	return c.JSON(scenario)
}

func deleteMockScenario(c *fiber.Ctx) error {
	scenarioID := c.Params("scenarioId")
	if scenarioID == "" || scenarioID == "undefined" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid scenario ID", "code": "INVALID_ID"})
	}
	if err := repository.DB.Delete(&repository.MockScenario{}, "id = ?", scenarioID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error", "code": "DB_ERROR"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func reorderScenarios(c *fiber.Ctx) error {
	var input struct {
		Scenarios []struct {
			ID         uint    `json:"id"`
			OrderIndex float64 `json:"order_index"`
		} `json:"scenarios"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	tx := repository.DB.Begin()
	for _, s := range input.Scenarios {
		if err := tx.Model(&repository.MockScenario{}).Where("id = ?", s.ID).Update("order_index", s.OrderIndex).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "DB error"})
		}
	}
	tx.Commit()
	return c.JSON(fiber.Map{"message": "Reordered"})
}

// ─── Mock Engine ─────────────────────────────────────────────────────────────

func evaluateScenario(c *fiber.Ctx, scenario *repository.MockScenario) bool {
	var conditions []map[string]interface{}
	bytes, _ := json.Marshal(scenario.Conditions)
	json.Unmarshal(bytes, &conditions)

	if len(conditions) == 0 {
		return false
	}

	for _, cond := range conditions {
		source := getString(cond, "source")
		key := getString(cond, "key")
		op := getString(cond, "operator")
		val := cond["value"]

		reqVal := extractRequestValue(c, source, key)
		if !compareValues(reqVal, op, val) {
			return false
		}
	}

	return true
}

func extractRequestValue(c *fiber.Ctx, source, key string) interface{} {
	switch source {
	case "query":
		return c.Query(key)
	case "header":
		return c.Get(key)
	case "path":
		return c.Params(key)
	case "body":
		var body map[string]interface{}
		if err := json.Unmarshal(c.Body(), &body); err == nil {
			return getNestedMapValue(body, key)
		}
	}
	return nil
}

func getNestedMapValue(m map[string]interface{}, path string) interface{} {
	parts := strings.Split(path, ".")
	var current interface{} = m
	for _, part := range parts {
		if curMap, ok := current.(map[string]interface{}); ok {
			current = curMap[part]
		} else {
			return nil
		}
	}
	return current
}

func compareValues(reqVal interface{}, op string, targetVal interface{}) bool {
	sReq := fmt.Sprintf("%v", reqVal)
	sTarget := fmt.Sprintf("%v", targetVal)

	switch op {
	case "equals":
		return sReq == sTarget
	case "not_equals":
		return sReq != sTarget
	case "contains":
		return strings.Contains(sReq, sTarget)
	case "not_contains":
		return !strings.Contains(sReq, sTarget)
	case "exists":
		return reqVal != nil && sReq != "" && sReq != "<nil>"
	case "not_exists":
		return reqVal == nil || sReq == "" || sReq == "<nil>"
	case "regex":
		match, _ := regexp.MatchString(sTarget, sReq)
		return match
	case "gt":
		return sReq > sTarget
	case "lt":
		return sReq < sTarget
	}
	return false
}

func renderMockTemplate(c *fiber.Ctx, body string) string {
	re := regexp.MustCompile(`{{\s*request\.(query|body|header|path)\.([\w\.-]+)\s*}}`)
	return re.ReplaceAllStringFunc(body, func(match string) string {
		sub := re.FindStringSubmatch(match)
		if len(sub) < 3 {
			return match
		}
		val := extractRequestValue(c, sub[1], sub[2])
		if val == nil {
			return ""
		}
		return fmt.Sprintf("%v", val)
	})
}

// ─── Mock Request Handler ─────────────────────────────────────────────────────

func handleMockRequest(c *fiber.Ctx) error {
	collectionID := c.Params("collection_id")
	rawPath := c.Params("*")
	if rawPath == "" {
		rawPath = "/"
	}
	if !strings.HasPrefix(rawPath, "/") {
		rawPath = "/" + rawPath
	}
	method := strings.ToUpper(c.Method())

	// Find matching active endpoint
	var endpoints []repository.MockEndpoint
	repository.DB.Where(
		"collection_id = ? AND is_active = true AND method = ?",
		collectionID, method,
	).Find(&endpoints)

	var matched *repository.MockEndpoint
	for i := range endpoints {
		ep := &endpoints[i]
		if matchPath(ep.Path, rawPath) {
			matched = ep
			break
		}
	}

	if matched == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "No active mock endpoint found",
			"code":    "MOCK_NOT_FOUND",
			"details": fiber.Map{"method": method, "path": rawPath},
		})
	}

	c.Set("X-Mock-Collection", collectionID)
	return serveMockEndpoint(c, matched)
}

// ─── Path matching ────────────────────────────────────────────────────────────

// matchPath matches an endpoint path pattern against an incoming request path.
// Supports {param} wildcards: e.g. /users/{id} matches /users/123
func matchPath(pattern, incoming string) bool {
	pattern = normalizePath(pattern)
	incoming = normalizePath(incoming)

	// Exact match
	if pattern == incoming {
		return true
	}

	// Wildcard match with {param}
	patternParts := strings.Split(strings.Trim(pattern, "/"), "/")
	incomingParts := strings.Split(strings.Trim(incoming, "/"), "/")

	if len(patternParts) != len(incomingParts) {
		return false
	}

	for i, part := range patternParts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			continue // wildcard segment
		}
		if part != incomingParts[i] {
			return false
		}
	}

	return true
}

func normalizePath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return path
}

// ─── Standalone Mock Handlers ───────────────────────────────────────────────

func listStandaloneEndpoints(c *fiber.Ctx) error {
	teamID := c.Params("teamId")
	if !canAccessTeam(c, uint(parseUint(teamID))) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var endpoints []repository.MockEndpoint
	repository.DB.Where("team_id = ? AND collection_id IS NULL", teamID).Order("id asc").Find(&endpoints)
	return c.JSON(endpoints)
}

func createStandaloneEndpoint(c *fiber.Ctx) error {
	teamID := uint(parseUint(c.Params("teamId")))
	if !canAccessTeam(c, teamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var input createMockEndpointInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "INVALID_BODY"})
	}

	if input.Method == "" || input.Path == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "method and path are required", "code": "VALIDATION_ERROR"})
	}

	endpoint := repository.MockEndpoint{
		Name:            input.Name,
		TeamID:          &teamID,
		CollectionID:    nil,
		Method:          strings.ToUpper(input.Method),
		Path:            normalizePath(input.Path),
		StatusCode:      input.StatusCode,
		ResponseHeaders: repository.JSONB(input.ResponseHeaders),
		ResponseBody:    input.ResponseBody,
		DelayMs:         input.DelayMs,
		IsActive:        true,
	}

	if err := repository.DB.Create(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create endpoint", "code": "DB_ERROR"})
	}

	return c.Status(fiber.StatusCreated).JSON(endpoint)
}

func handleStandaloneMockRequest(c *fiber.Ctx) error {
	teamIDStr := c.Params("team_id")
	teamID := parseUint(teamIDStr)
	rawPath := c.Params("*")
	if !strings.HasPrefix(rawPath, "/") {
		rawPath = "/" + rawPath
	}
	method := strings.ToUpper(c.Method())

	var endpoints []repository.MockEndpoint
	repository.DB.Where(
		"team_id = ? AND collection_id IS NULL AND is_active = true AND method = ?",
		teamID, method,
	).Find(&endpoints)

	var matched *repository.MockEndpoint
	for i := range endpoints {
		ep := &endpoints[i]
		if matchPath(ep.Path, rawPath) {
			matched = ep
			break
		}
	}

	if matched == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "No active standalone mock endpoint found",
			"code":  "MOCK_NOT_FOUND",
		})
	}

	return serveMockEndpoint(c, matched)
}

// serveMockEndpoint is a shared helper for both collection and standalone mocks
func serveMockEndpoint(c *fiber.Ctx, matched *repository.MockEndpoint) error {
	startTime := time.Now()
	var responseBody string
	var statusCode int = 200
	var responseHeaders map[string]interface{}
	var binaryData []byte
	found := false

	// EVALUATION LOGIC
	if matched.EvaluationMode == "manual" && matched.ActiveScenarioID != nil {
		var scenario repository.MockScenario
		if err := repository.DB.First(&scenario, *matched.ActiveScenarioID).Error; err == nil {
			if scenario.ResponseType == "file" && scenario.FileBase64 != "" {
				binaryData, _ = base64.StdEncoding.DecodeString(scenario.FileBase64)
				c.Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", scenario.FileName))
				ext := filepath.Ext(scenario.FileName)
				if mimeType := mime.TypeByExtension(ext); mimeType != "" {
					c.Set("Content-Type", mimeType)
				}
			} else {
				responseBody = scenario.ResponseBody
			}
			statusCode = scenario.StatusCode
			bytes, _ := json.Marshal(scenario.ResponseHeaders)
			json.Unmarshal(bytes, &responseHeaders)
			found = true
		}
	}

	if !found {
		var scenarios []repository.MockScenario
		repository.DB.Where("mock_endpoint_id = ?", matched.ID).Order("order_index asc, id asc").Find(&scenarios)
		var selected *repository.MockScenario
		for i := range scenarios {
			if evaluateScenario(c, &scenarios[i]) {
				selected = &scenarios[i]
				break
			}
		}
		if selected == nil {
			for i := range scenarios {
				if scenarios[i].IsDefault {
					selected = &scenarios[i]
					break
				}
			}
		}
		if selected != nil {
			if selected.ResponseType == "file" && selected.FileBase64 != "" {
				binaryData, _ = base64.StdEncoding.DecodeString(selected.FileBase64)
				c.Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", selected.FileName))
				ext := filepath.Ext(selected.FileName)
				if mimeType := mime.TypeByExtension(ext); mimeType != "" {
					c.Set("Content-Type", mimeType)
				}
			} else {
				responseBody = selected.ResponseBody
			}
			statusCode = selected.StatusCode
			bytes, _ := json.Marshal(selected.ResponseHeaders)
			json.Unmarshal(bytes, &responseHeaders)
			found = true
		}
	}

	if !found {
		responseBody = matched.ResponseBody
		statusCode = matched.StatusCode
		bytes, _ := json.Marshal(matched.ResponseHeaders)
		json.Unmarshal(bytes, &responseHeaders)
	}

	if binaryData == nil {
		responseBody = renderMockTemplate(c, responseBody)
	}

	// ── Chaos mode: check collection-level flag (cached 5s) ──────────────────
	chaosModeActive := false
	if matched.CollectionID != nil {
		chaosModeActive = getChaosMode(*matched.CollectionID)
	}

	// ── Error injection (per-endpoint rate, amplified by chaos mode) ──────────
	injectedError := false
	effectiveErrorRate := matched.ErrorRate
	if chaosModeActive && effectiveErrorRate < 50 {
		effectiveErrorRate = 50 // chaos mode: minimum 50% error rate
	}
	if effectiveErrorRate > 0 && rand.Intn(100) < effectiveErrorRate {
		errStatus := matched.ErrorStatusCode
		if errStatus < 400 || errStatus > 599 {
			errStatus = 500
		}
		statusCode = errStatus
		responseBody = fmt.Sprintf(`{"error":"Simulated error","code":"%d","injected":true}`, errStatus)
		binaryData = nil
		injectedError = true
	}

	// ── Delay simulation (fixed or random range) ──────────────────────────────
	delayMin := matched.DelayMs
	delayMax := matched.DelayMaxMs
	if chaosModeActive && delayMin == 0 {
		delayMin = 500
		delayMax = 2000
	}
	if delayMin > 0 {
		actualDelay := delayMin
		if delayMax > delayMin {
			actualDelay = delayMin + rand.Intn(delayMax-delayMin+1)
		}
		time.Sleep(time.Duration(actualDelay) * time.Millisecond)
	}

	for k, v := range responseHeaders {
		if sv, ok := v.(string); ok {
			c.Set(k, sv)
		}
	}

	c.Set("X-Wapbolt-Mock", "true")
	if injectedError {
		c.Set("X-Wapbolt-Injected-Error", "true")
	}

	// ── Async request log ─────────────────────────────────────────────────────
	latencyMs := int(time.Since(startTime).Milliseconds())
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Error().Interface("panic", r).Msg("mock log goroutine panic")
			}
		}()
		endpointID := matched.ID
		entry := repository.MockRequestLog{
			EndpointID:    &endpointID,
			CollectionID:  matched.CollectionID,
			Method:        matched.Method,
			Path:          c.Path(),
			Matched:       true,
			InjectedError: injectedError,
			StatusCode:    statusCode,
			LatencyMs:     latencyMs,
		}
		repository.DB.Create(&entry)
	}()

	if binaryData != nil {
		return c.Status(statusCode).Send(binaryData)
	}
	if c.Get("Content-Type") == "" {
		c.Set("Content-Type", "application/json")
	}
	return c.Status(statusCode).SendString(responseBody)
}

// ─── Chaos Mode ───────────────────────────────────────────────────────────────

func updateCollectionChaosMode(c *fiber.Ctx) error {
	collectionID := parseUint(c.Params("id"))
	if collectionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid collection ID"})
	}
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var input struct {
		ChaosMode bool `json:"chaos_mode"`
	}
	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if err := repository.DB.Model(&col).Update("chaos_mode", input.ChaosMode).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update"})
	}
	invalidateChaosCache(uint(collectionID))
	return c.JSON(fiber.Map{"chaos_mode": input.ChaosMode})
}

// ─── Mock Request Logs ────────────────────────────────────────────────────────

func listMockRequestLogs(c *fiber.Ctx) error {
	collectionID := parseUint(c.Params("id"))
	if collectionID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid collection ID"})
	}
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found"})
	}
	if !canAccessTeam(c, col.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	var logs []repository.MockRequestLog
	repository.DB.
		Where("collection_id = ?", collectionID).
		Order("created_at DESC").
		Limit(200).
		Find(&logs)

	return c.JSON(logs)
}

// ─── Generate Mocks From Collection ──────────────────────────────────────────

func generateMocksFromCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")
	var col repository.Collection
	if err := repository.DB.First(&col, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found"})
	}

	var requests []repository.Request
	repository.DB.Where("collection_id = ?", col.ID).Preload("Examples").Find(&requests)

	count := 0
	for _, req := range requests {
		// Create or find endpoint
		var endpoint repository.MockEndpoint
		path := extractURLPath(req.URL)
		err := repository.DB.Where("collection_id = ? AND method = ? AND path = ?", col.ID, req.Method, path).First(&endpoint).Error

		if err != nil { // Not found, create new
			endpoint = repository.MockEndpoint{
				CollectionID:   &col.ID,
				Method:         req.Method,
				Path:           path,
				StatusCode:     200,
				IsActive:       true,
				EvaluationMode: "auto",
			}
			repository.DB.Create(&endpoint)
		}

		// Create scenarios from examples
		for _, ex := range req.Examples {
			var scenario repository.MockScenario
			err := repository.DB.Where("mock_endpoint_id = ? AND name = ?", endpoint.ID, ex.Name).First(&scenario).Error
			if err != nil {
				scenario = repository.MockScenario{
					MockEndpointID:  endpoint.ID,
					Name:            ex.Name,
					StatusCode:      ex.ResponseStatus,
					ResponseBody:    ex.ResponseBody,
					ResponseHeaders: ex.ResponseHeaders,
				}
				repository.DB.Create(&scenario)
				count++
			}
		}
	}

	return c.JSON(fiber.Map{"message": fmt.Sprintf("Generated %d mock scenarios", count), "count": count})
}
