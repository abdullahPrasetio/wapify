package api

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapify-backend/internal/repository"
)

// SetupMockServerRoutes registers mock server endpoints
func SetupMockServerRoutes(app *fiber.App) {
	// Management API (protected via JWT)
	mock := app.Group("/api/v1/collections/:id/mock", mockAuthMiddleware)
	mock.Get("/endpoints", listMockEndpoints)
	mock.Post("/endpoints", createMockEndpoint)
	mock.Put("/endpoints/:endpointId", updateMockEndpoint)
	mock.Delete("/endpoints/:endpointId", deleteMockEndpoint)
	mock.Post("/endpoints/:endpointId/from-request/:requestId", createMockFromRequest)

	// The actual mock server — public, no auth needed
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
	Method          string                 `json:"method"`
	Path            string                 `json:"path"`
	StatusCode      int                    `json:"status_code"`
	ResponseHeaders map[string]interface{} `json:"response_headers"`
	ResponseBody    string                 `json:"response_body"`
	DelayMs         int                    `json:"delay_ms"`
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
	endpoint := repository.MockEndpoint{
		CollectionID:    colID,
		Method:          strings.ToUpper(input.Method),
		Path:            normalizePath(input.Path),
		StatusCode:      input.StatusCode,
		ResponseHeaders: repository.JSONB(input.ResponseHeaders),
		ResponseBody:    input.ResponseBody,
		DelayMs:         input.DelayMs,
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

	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}
	if input.Method != "" {
		updates["method"] = strings.ToUpper(input.Method)
	}
	if input.Path != "" {
		updates["path"] = normalizePath(input.Path)
	}
	if input.StatusCode > 0 {
		updates["status_code"] = input.StatusCode
	}
	if input.ResponseBody != "" {
		updates["response_body"] = input.ResponseBody
	}
	if input.ResponseHeaders != nil {
		updates["response_headers"] = repository.JSONB(input.ResponseHeaders)
	}
	updates["delay_ms"] = input.DelayMs

	if err := repository.DB.Model(&endpoint).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update", "code": "DB_ERROR"})
	}

	repository.DB.First(&endpoint, endpointID)
	return c.JSON(endpoint)
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
		CollectionID: colID,
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
	method := c.Method()

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

	// Apply delay
	if matched.DelayMs > 0 {
		delay := matched.DelayMs
		if delay > 10000 {
			delay = 10000 // cap at 10s
		}
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}

	// Set response headers
	for k, v := range matched.ResponseHeaders {
		if sv, ok := v.(string); ok {
			c.Set(k, sv)
		}
	}

	// Ensure Content-Type is set
	if matched.ResponseHeaders["Content-Type"] == nil {
		c.Set("Content-Type", "application/json")
	}

	// Set CORS headers for convenience
	c.Set("X-Wapify-Mock", "true")
	c.Set("X-Mock-Collection", collectionID)

	return c.Status(matched.StatusCode).SendString(matched.ResponseBody)
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
