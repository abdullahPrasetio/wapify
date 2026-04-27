package api

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-backend/internal/repository"
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
	mock.Patch("/endpoints/:endpointId/mode", updateMockMode)

	// Scenario CRUD
	mock.Get("/endpoints/:endpointId/scenarios", listMockScenarios)
	mock.Post("/endpoints/:endpointId/scenarios", createMockScenario)
	mock.Put("/endpoints/:endpointId/scenarios/:scenarioId", updateMockScenario)
	mock.Delete("/endpoints/:endpointId/scenarios/:scenarioId", deleteMockScenario)
	mock.Patch("/endpoints/:endpointId/scenarios/reorder", reorderScenarios)

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
	Path             string                 `json:"path"`
	StatusCode      int                    `json:"status_code"`
	ResponseHeaders map[string]interface{} `json:"response_headers"`
	ResponseBody    string                 `json:"response_body"`
	DelayMs         int                    `json:"delay_ms"`
	IsActive        *bool                  `json:"is_active"`
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
	endpoint.UpdatedAt = time.Now()

	if err := repository.DB.Save(&endpoint).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update", "code": "DB_ERROR"})
	}

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
				} else if strings.ToLower(ext) == ".pdf" {
					c.Set("Content-Type", "application/pdf")
				} else {
					c.Set("Content-Type", "application/octet-stream")
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

	// Dynamic evaluation or fallback
	if !found {
		var scenarios []repository.MockScenario
		repository.DB.Where("mock_endpoint_id = ?", matched.ID).Order("order_index asc, id asc").Find(&scenarios)

		var selected *repository.MockScenario
		// 1. Try to match conditions
		for i := range scenarios {
			if evaluateScenario(c, &scenarios[i]) {
				selected = &scenarios[i]
				break
			}
		}

		// 2. If no match, find default scenario
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
				} else if strings.ToLower(ext) == ".pdf" {
					c.Set("Content-Type", "application/pdf")
				} else {
					c.Set("Content-Type", "application/octet-stream")
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

	// Ultimate fallback to base endpoint fields if no scenario found/matched
	if !found {
		responseBody = matched.ResponseBody
		statusCode = matched.StatusCode
		bytes, _ := json.Marshal(matched.ResponseHeaders)
		json.Unmarshal(bytes, &responseHeaders)
	}

	// Apply templating (only for text)
	if binaryData == nil {
		responseBody = renderMockTemplate(c, responseBody)
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
	for k, v := range responseHeaders {
		if sv, ok := v.(string); ok {
			c.Set(k, sv)
		}
	}

	// Set CORS headers for convenience
	c.Set("X-Wapbolt-Mock", "true")
	c.Set("X-Mock-Collection", collectionID)

	if binaryData != nil {
		return c.Status(statusCode).Send(binaryData)
	}

	// For Text/JSON, ensure Content-Type is set if not already present
	if c.Get("Content-Type") == "" {
		c.Set("Content-Type", "application/json")
	}

	return c.Status(statusCode).SendString(responseBody)
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
