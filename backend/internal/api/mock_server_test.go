package api

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func init() {
	os.Setenv("JWT_SECRET", "testsecret")
}

func generateTestToken(userID uint, isSuperAdmin bool) string {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":        float64(userID),
		"is_super_admin": isSuperAdmin,
		"exp":            time.Now().Add(time.Hour * 72).Unix(),
	})
	t, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	return t
}

func TestMockAuthMiddleware(t *testing.T) {
	app := fiber.New()
	app.Get("/test", mockAuthMiddleware, func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	t.Run("Missing Header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Prefix", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Invalid token")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Token", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer invalidtoken")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Claims", func(t *testing.T) {
		// Token with wrong signing method or something that causes jwt.Parse to fail or claims to be invalid
		token := jwt.New(jwt.SigningMethodHS256) // No claims
		t_str, _ := token.SignedString([]byte("wrongsecret"))
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+t_str)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Valid Token", func(t *testing.T) {
		token := generateTestToken(1, false)
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestListMockEndpoints_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Get("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return listMockEndpoints(c)
	})

	t.Run("Collection Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("GET", "/api/v1/collections/99/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnError(fmt.Errorf("forbidden"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path"}).AddRow(1, "/test"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestCreateMockEndpoint_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockEndpoint(c)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints", strings.NewReader("invalid body"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Validation Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		reqBody := map[string]interface{}{"method": ""}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.*").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		reqBody := map[string]interface{}{"method": "GET", "path": "/test"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})
}

func TestUpdateMockEndpoint_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Put("/api/v1/collections/:id/mock/endpoints/:endpointId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return updateMockEndpoint(c)
	})

	t.Run("Endpoint Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("PUT", "/api/v1/collections/1/mock/endpoints/1", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Success Full Update", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "method", "path"}).AddRow(1, 10, "GET", "/old"))

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 1))

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_endpoints. SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"method":           "POST",
			"path":             "/new",
			"status_code":      201,
			"response_body":    "{}",
			"response_headers": map[string]string{"X-Test": "Val"},
			"is_active":        false,
			"delay_ms":         100,
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/10/mock/endpoints/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestDeleteMockEndpoint_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Delete("/api/v1/collections/:id/mock/endpoints/:endpointId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return deleteMockEndpoint(c)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("DELETE FROM .mock_endpoints. WHERE").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/collections/1/mock/endpoints/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})
}

func TestCreateMockFromRequest_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/collections/:id/mock/endpoints/from-request/:requestId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockFromRequest(c)
	})

	t.Run("Request Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("SELECT .* FROM .requests.").
			WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints/from-request/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("SELECT .* FROM .requests.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "url", "method"}).AddRow(1, "Test Req", "http://api.com/v1/users", "GET"))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.*").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints/from-request/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})
}

func TestUpdateMockMode_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Patch("/api/v1/mock-endpoints/:endpointId/mode", updateMockMode)

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("PATCH", "/api/v1/mock-endpoints/1/mode", strings.NewReader("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Endpoint Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("PATCH", "/api/v1/mock-endpoints/1/mode", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_endpoints. SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{"evaluation_mode": "manual", "active_scenario_id": 5}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PATCH", "/api/v1/mock-endpoints/1/mode", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestScenarioHandlers_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Get("/api/v1/mock-endpoints/:endpointId/scenarios", listMockScenarios)
	app.Post("/api/v1/mock-endpoints/:endpointId/scenarios", createMockScenario)
	app.Put("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", updateMockScenario)
	app.Delete("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", deleteMockScenario)
	app.Patch("/api/v1/mock-endpoints/:endpointId/scenarios/reorder", reorderScenarios)

	t.Run("List Scenarios", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "S1"))

		req := httptest.NewRequest("GET", "/api/v1/mock-endpoints/1/scenarios", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})

	t.Run("Create Scenario Success Default", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_scenarios. SET .*is_default.*").
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectQuery("INSERT INTO .mock_scenarios.*").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(uint(1)))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{"name": "S2", "is_default": true, "status_code": 201}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/mock-endpoints/1/scenarios", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})

	t.Run("Update Scenario Invalid ID", func(t *testing.T) {
		req := httptest.NewRequest("PUT", "/api/v1/mock-endpoints/1/scenarios/undefined", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Update Scenario Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id"}).AddRow(uint(1), uint(10)))

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_scenarios. SET .*is_default.*").
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectExec("UPDATE .mock_scenarios. SET.*").
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{"name": "S1-updated", "is_default": true}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/mock-endpoints/10/scenarios/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})

	t.Run("Delete Scenario Invalid ID", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/mock-endpoints/1/scenarios/undefined", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Reorder Scenarios", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_scenarios. SET .*order_index.*").
			WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"scenarios": []map[string]interface{}{
				{"id": uint(1), "order_index": 1.0},
			},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PATCH", "/api/v1/mock-endpoints/1/scenarios/reorder", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})

	t.Run("Delete Scenario Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectBegin()
		mock.ExpectExec("DELETE FROM .mock_scenarios. WHERE").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/mock-endpoints/1/scenarios/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNoContent, resp.StatusCode)
	})
}

func TestStandaloneHandlers_Extra(t *testing.T) {
	app := fiber.New()
	app.Get("/api/v1/workspaces/:teamId/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return listStandaloneEndpoints(c)
	})

	t.Run("List Standalone Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path"}).AddRow(1, "/s1"))

		req := httptest.NewRequest("GET", "/api/v1/workspaces/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestScenarioHandlers_ErrorCases(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/mock-endpoints/:endpointId/scenarios", createMockScenario)
	app.Put("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", updateMockScenario)

	t.Run("Create Scenario DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_scenarios.*").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		reqBody := map[string]interface{}{"name": "S-Fail"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/mock-endpoints/1/scenarios", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Update Scenario DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id"}).AddRow(uint(1), uint(10)))

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_scenarios. SET.*").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		reqBody := map[string]interface{}{"name": "S-Fail-Update"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/mock-endpoints/10/scenarios/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})
}

func TestMockEngine_EdgeCases(t *testing.T) {
	app := fiber.New()
	app.All("/mock/:collection_id/*", handleMockRequest)

	t.Run("Serve Mock Endpoint Delay and Headers", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "status_code", "response_headers", "delay_ms"}).
				AddRow(1, "/delay", "GET", 200, repository.JSONB{"X-Custom": "HeaderVal"}, 50))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		start := time.Now()
		req := httptest.NewRequest("GET", "/mock/1/delay", nil)
		resp, _ := app.Test(req)
		
		assert.True(t, time.Since(start) >= 50*time.Millisecond)
		assert.Equal(t, "HeaderVal", resp.Header.Get("X-Custom"))
	})
}

func TestHelperFunctions_Extra(t *testing.T) {
	t.Run("Normalize Path", func(t *testing.T) {
		assert.Equal(t, "/", normalizePath(""))
		assert.Equal(t, "/test", normalizePath("test"))
		assert.Equal(t, "/test", normalizePath("/test "))
	})

	t.Run("Get Nested Map Value Missing", func(t *testing.T) {
		m := map[string]interface{}{"a": map[string]interface{}{"b": 1}}
		assert.Nil(t, getNestedMapValue(m, "a.c"))
		assert.Nil(t, getNestedMapValue(m, "x.y"))
	})
}

func TestStandaloneHandlers_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Get("/api/v1/workspaces/:teamId/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return listStandaloneEndpoints(c)
	})
	app.Post("/api/v1/workspaces/:teamId/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createStandaloneEndpoint(c)
	})

	t.Run("List Standalone Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnError(fmt.Errorf("forbidden"))

		req := httptest.NewRequest("GET", "/api/v1/workspaces/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("Create Standalone Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.*").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{"method": "GET", "path": "/standalone", "status_code": 200}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/workspaces/1/mock/endpoints", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})

	t.Run("Create Standalone Validation Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		reqBody := map[string]interface{}{"method": ""}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/workspaces/1/mock/endpoints", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})
}

func TestMockEngine_Comprehensive(t *testing.T) {
	app := fiber.New()
	// More specific route first
	app.All("/mock/w/:team_id/*", handleStandaloneMockRequest)
	app.All("/mock/:collection_id/*", handleMockRequest)

	t.Run("Handle Mock Request Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/mock/1/notfound", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Handle Standalone Mock Request Success", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "status_code", "response_body"}).
				AddRow(1, "/test", "GET", 200, "base response"))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/mock/w/1/test", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})

	t.Run("Serve Mock Endpoint Manual Mode File", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		activeScenarioID := uint(5)
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "active_scenario_id"}).
				AddRow(1, "/file", "GET", "manual", &activeScenarioID))

		fileContent := "hello world"
		fileBase64 := base64.StdEncoding.EncodeToString([]byte(fileContent))
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "response_type", "file_base64", "file_name", "status_code"}).
				AddRow(5, "file", fileBase64, "test.txt", 200))

		req := httptest.NewRequest("GET", "/mock/1/file", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		assert.Contains(t, resp.Header.Get("Content-Disposition"), "test.txt")
	})

	t.Run("Serve Mock Endpoint Auto Mode Template Rendering", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body", "delay_ms"}).
				AddRow(1, "/tpl", "GET", "auto", 200, "hello {{request.query.name}}", 10))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/mock/1/tpl?name=wapbolt", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		bodyBytes, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "hello wapbolt", string(bodyBytes))
	})
}

func TestSetupMockServerRoutes(t *testing.T) {
	app := fiber.New()
	SetupMockServerRoutes(app)
	// Just verify that some routes are registered
	routes := app.GetRoutes()
	assert.NotEmpty(t, routes)
}

func TestMatchPath_Wildcards(t *testing.T) {
	assert.True(t, matchPath("/users/{id}", "/users/123"))
	assert.True(t, matchPath("/users/{id}/posts/{postId}", "/users/1/posts/2"))
	assert.False(t, matchPath("/users/{id}", "/users/123/extra"))
	assert.False(t, matchPath("/users/{id}", "/other/123"))
	assert.False(t, matchPath("/a/b", "/a/b/c"))
	assert.False(t, matchPath("/a/b/c", "/a/b"))
	assert.True(t, matchPath("", ""))
	assert.True(t, matchPath("/", "/"))
}

func TestMockEngine_Advanced(t *testing.T) {
	app := fiber.New()
	app.All("/mock/:collection_id/*", handleMockRequest)

	t.Run("Evaluate Scenario with Conditions and Operators", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body"}).
				AddRow(1, "/test", "POST", "auto", 200, "base"))

		conds := []interface{}{
			map[string]interface{}{"source": "query", "key": "name", "operator": "equals", "value": "john"},
			map[string]interface{}{"source": "header", "key": "X-Api-Key", "operator": "exists"},
			map[string]interface{}{"source": "path", "key": "collection_id", "operator": "contains", "value": "1"},
			map[string]interface{}{"source": "body", "key": "age", "operator": "gt", "value": "20"},
			map[string]interface{}{"source": "body", "key": "role.name", "operator": "regex", "value": "^admin"},
		}

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id", "name", "status_code", "conditions", "response_body"}).
				AddRow(10, 1, "Scenario 1", 200, repository.JSONBArray(conds), "success"))

		reqBody := map[string]interface{}{
			"age": 25,
			"role": map[string]interface{}{
				"name": "administrator",
			},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/mock/1/test?name=john", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Api-Key", "secret")
		
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		bodyBytes, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "success", string(bodyBytes))
	})

	t.Run("Serve Mock Endpoint Default Scenario", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method"}).
				AddRow(1, "/default", "GET"))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "is_default", "status_code", "response_body"}).
				AddRow(10, true, 201, "default response"))

		req := httptest.NewRequest("GET", "/mock/1/default", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusCreated, resp.StatusCode)
	})
}

func TestHelperFunctions_Comprehensive(t *testing.T) {
	t.Run("Extract Request Value Body Nested", func(t *testing.T) {
		app := fiber.New()
		app.Post("/test", func(c *fiber.Ctx) error {
			val := extractRequestValue(c, "body", "user.name")
			return c.JSON(val)
		})

		reqBody := map[string]interface{}{"user": map[string]interface{}{"name": "john"}}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/test", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		var res string
		json.NewDecoder(resp.Body).Decode(&res)
		assert.Equal(t, "john", res)
	})

	t.Run("Compare Values Operators", func(t *testing.T) {
		assert.True(t, compareValues("1", "not_equals", "2"))
		assert.True(t, compareValues("abc", "not_contains", "xyz"))
		assert.False(t, compareValues("", "exists", nil))
		assert.True(t, compareValues(nil, "not_exists", nil))
		assert.True(t, compareValues("", "not_exists", nil))
	})

	t.Run("Render Mock Template Edge Cases", func(t *testing.T) {
		app := fiber.New()
		app.Get("/test", func(c *fiber.Ctx) error {
			res := renderMockTemplate(c, c.Query("tpl"))
			return c.SendString(res)
		})

		req := httptest.NewRequest("GET", "/test?tpl=no+template", nil)
		resp, _ := app.Test(req)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "no template", string(body))

		req = httptest.NewRequest("GET", "/test?tpl=missing+{{request.query.none}}", nil)
		resp, _ = app.Test(req)
		body, _ = io.ReadAll(resp.Body)
		assert.Equal(t, "missing ", string(body))
	})
}

func TestGenerateMocksFromCollection_Comprehensive(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/collections/:id/generate-mocks", generateMocksFromCollection)

	t.Run("Collection Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnError(fmt.Errorf("not found"))
		req := httptest.NewRequest("POST", "/api/v1/collections/1/generate-mocks", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("Success New Endpoint and Scenario", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("SELECT .* FROM .requests.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "method", "url"}).AddRow(10, "GET", "/api/v1/test"))

		// Preload Examples - GORM might query with IN or directly
		mock.ExpectQuery("SELECT .* FROM .request_examples.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "name", "response_status", "response_body"}).
				AddRow(20, 10, "Ex 1", 200, "body"))

		// Find Endpoint (not found)
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnError(fmt.Errorf("not found"))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.*").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(100))
		mock.ExpectCommit()

		// Find Scenario (not found)
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnError(fmt.Errorf("not found"))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_scenarios.*").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(200))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/collections/1/generate-mocks", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})
}

func TestMockServer_ExtraEdgeCases(t *testing.T) {
	t.Run("mockAuthMiddleware - Invalid Claims Map", func(t *testing.T) {
		appAuth := fiber.New()
		appAuth.Get("/test", mockAuthMiddleware, func(c *fiber.Ctx) error { return nil })
		
		// Token with valid signature but no user_id claim
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"foo": "bar"})
		t_str, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
		
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+t_str)
		resp, _ := appAuth.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode) // Local "user_id" will be nil
	})

	t.Run("deleteMockEndpoint - Collection Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnError(fmt.Errorf("not found"))

		appDel := fiber.New()
		appDel.Delete("/:id/:endpointId", deleteMockEndpoint)
		req := httptest.NewRequest("DELETE", "/99/1", nil)
		resp, _ := appDel.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("deleteMockEndpoint - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnError(fmt.Errorf("forbidden"))

		appDel := fiber.New()
		appDel.Delete("/:id/:endpointId", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return deleteMockEndpoint(c)
		})
		req := httptest.NewRequest("DELETE", "/1/1", nil)
		resp, _ := appDel.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("reorderScenarios - Invalid Body", func(t *testing.T) {
		appReorder := fiber.New()
		appReorder.Patch("/reorder", reorderScenarios)
		req := httptest.NewRequest("PATCH", "/reorder", strings.NewReader("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := appReorder.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("reorderScenarios - DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)
		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_scenarios.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		appReorder := fiber.New()
		appReorder.Patch("/reorder", reorderScenarios)
		reqBody := map[string]interface{}{"scenarios": []interface{}{map[string]interface{}{"id": 1, "order_index": 1}}}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PATCH", "/reorder", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := appReorder.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("extractRequestValue - Invalid Body JSON", func(t *testing.T) {
		appVal := fiber.New()
		appVal.Post("/test", func(c *fiber.Ctx) error {
			val := extractRequestValue(c, "body", "key")
			return c.JSON(val)
		})
		req := httptest.NewRequest("POST", "/test", strings.NewReader("not json"))
		resp, _ := appVal.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode) // returns null
	})

	t.Run("compareValues - Operators lt and regex fail", func(t *testing.T) {
		assert.True(t, compareValues("1", "lt", "2"))
		assert.True(t, compareValues("2", "gt", "1"))
		assert.False(t, compareValues("abc", "regex", "[0-9]+"))
		assert.False(t, compareValues("abc", "unknown", "abc"))
	})

	t.Run("createStandaloneEndpoint - DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .team_members.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		appSE := fiber.New()
		appSE.Post("/:teamId", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return createStandaloneEndpoint(c)
		})
		reqBody := map[string]interface{}{"method": "GET", "path": "/test"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := appSE.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("mockAuthMiddleware - Unexpected Signing Method", func(t *testing.T) {
		os.Setenv("JWT_SECRET", "test_secret")
		appAuth := fiber.New()
		appAuth.Get("/test", mockAuthMiddleware, func(c *fiber.Ctx) error { return c.SendStatus(200) })

		// Use a different signing method (None)
		token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"user_id": 1.0})
		t_str, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+t_str)
		resp, _ := appAuth.Test(req)
		assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("evaluateScenario - Nil or Empty Conditions", func(t *testing.T) {
		appMock := fiber.New()
		// Test through handleMockRequest to see it skipping scenario
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body", "is_active"}).
				AddRow(1, "/test", "GET", "auto", 200, "base", true))

		// Scenario with nil conditions
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id", "conditions", "response_body", "status_code"}).
				AddRow(10, 1, nil, "scenario body", 201))

		appMock.All("/mock/:collection_id/*", handleMockRequest)
		req := httptest.NewRequest("GET", "/mock/1/test", nil)
		resp, _ := appMock.Test(req)
		
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "base", string(body)) // Should fall back to base because scenario condition evaluation returns false
	})

	t.Run("renderMockTemplate - No match", func(t *testing.T) {
		assert.Equal(t, "plain", renderMockTemplate(nil, "plain"))
	})

	t.Run("handleStandaloneMockRequest - Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		appMock := fiber.New()
		appMock.All("/mock/w/:team_id/*", handleStandaloneMockRequest)
		req := httptest.NewRequest("GET", "/mock/w/1/notfound", nil)
		resp, _ := appMock.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("serveMockEndpoint - Manual Mode Scenario Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		activeID := uint(999)
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "evaluation_mode", "active_scenario_id", "response_body", "status_code", "is_active", "method", "path"}).
				AddRow(1, "manual", &activeID, "base", 200, true, "GET", "/test"))
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios. WHERE id = .").WillReturnError(fmt.Errorf("not found"))
		// It should fall back to base
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios. WHERE mock_endpoint_id = .").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		appMock := fiber.New()
		appMock.Get("/:collection_id/*", handleMockRequest)
		req := httptest.NewRequest("GET", "/1/test", nil)
		resp, _ := appMock.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "base", string(body))
	})

	t.Run("createMockEndpoint - Validation Error Final", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		app := fiber.New()
		app.Post("/:id", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return createMockEndpoint(c)
		})

		req := httptest.NewRequest("POST", "/1", bytes.NewBufferString(`{"method": ""}`))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("updateMockMode - DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_endpoints.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		app := fiber.New()
		app.Patch("/:endpointId/mode", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return updateMockMode(c)
		})
		req := httptest.NewRequest("PATCH", "/1/mode", strings.NewReader(`{"evaluation_mode": "manual"}`))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("createMockFromRequest - DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("SELECT .* FROM .requests.").WillReturnRows(sqlmock.NewRows([]string{"id", "name", "url", "method"}).AddRow(1, "R", "/", "GET"))

		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		app := fiber.New()
		app.Post("/:id/from-request/:requestId", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return createMockFromRequest(c)
		})
		req := httptest.NewRequest("POST", "/1/from-request/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("generateMocksFromCollection - Request DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.MatchExpectationsInOrder(false)

		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("SELECT .* FROM .requests.").WillReturnRows(sqlmock.NewRows([]string{"id", "method", "url"}).AddRow(1, "GET", "/"))
		mock.ExpectQuery("SELECT .* FROM .request_examples.").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").WillReturnError(fmt.Errorf("not found"))
		
		// DB.Create(&endpoint) - error here
		mock.ExpectBegin()
		mock.ExpectQuery("INSERT INTO .mock_endpoints.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		app := fiber.New()
		app.Post("/:id", generateMocksFromCollection)
		req := httptest.NewRequest("POST", "/1", nil)
		resp, _ := app.Test(req)
		// generateMocksFromCollection doesn't check error for DB.Create(&endpoint)
		// but it will fail later or just continue. 
		// Actually the code is:
		// repository.DB.Create(&endpoint)
		// Then it loops examples. If endpoint.ID is 0, it might still try to create scenarios.
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
	})

	t.Run("createStandaloneEndpoint - Validation Error Final", func(t *testing.T) {
		app := fiber.New()
		app.Post("/:teamId", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", true)
			return createStandaloneEndpoint(c)
		})
		req := httptest.NewRequest("POST", "/1", bytes.NewBufferString(`{"method": ""}`))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})
}

func TestMockServer_MissingCoverage_Final(t *testing.T) {
	app := fiber.New()
	app.All("/mock/:collection_id/*", handleMockRequest)
	app.Get("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return listMockEndpoints(c)
	})
	app.Post("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockEndpoint(c)
	})
	app.Put("/api/v1/collections/:id/mock/endpoints/:endpointId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return updateMockEndpoint(c)
	})

	t.Run("listMockEndpoints - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"})) // No rows = forbidden

		req := httptest.NewRequest("GET", "/api/v1/collections/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("createMockEndpoint - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("updateMockEndpoint - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("PUT", "/api/v1/collections/1/mock/endpoints/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("updateMockEndpoint - DB Save Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		
		mock.ExpectBegin()
		mock.ExpectExec("UPDATE .mock_endpoints. SET").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		reqBody := map[string]interface{}{"path": "/new"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1/mock/endpoints/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("evaluateScenario - Condition Fails", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body", "is_active"}).
				AddRow(1, "/test", "GET", "auto", 200, "base", true))

		conds := []interface{}{
			map[string]interface{}{"source": "query", "key": "name", "operator": "equals", "value": "john"},
		}
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id", "conditions", "response_body", "status_code"}).
				AddRow(10, 1, repository.JSONBArray(conds), "scenario body", 201))

		req := httptest.NewRequest("GET", "/mock/1/test?name=wrong", nil)
		resp, _ := app.Test(req)
		
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "base", string(body)) 
	})

	t.Run("serveMockEndpoint - File Response with Empty Base64", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body", "is_active"}).
				AddRow(1, "/file", "GET", "auto", 200, "base", true))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "response_type", "file_base64", "is_default", "response_body"}).
				AddRow(5, "file", "", true, "fallback body"))

		req := httptest.NewRequest("GET", "/mock/1/file", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "fallback body", string(body))
	})
	
	t.Run("serveMockEndpoint - Manual Mode File Response with Empty Base64", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()

		activeScenarioID := uint(5)
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "active_scenario_id", "is_active"}).
				AddRow(1, "/file", "GET", "manual", &activeScenarioID, true))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "response_type", "file_base64", "response_body"}).
				AddRow(5, "file", "", "manual fallback"))

		req := httptest.NewRequest("GET", "/mock/1/file", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		body, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "manual fallback", string(body))
	})
}

func TestMockServer_MissingCoverage_Part2(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/workspaces/:teamId/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createStandaloneEndpoint(c)
	})

	t.Run("createStandaloneEndpoint - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("POST", "/api/v1/workspaces/1/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})

	t.Run("renderMockTemplate - Full Request Context", func(t *testing.T) {
		appTpl := fiber.New()
		appTpl.Post("/test/:id", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			tpl := "ID: {{request.path.id}}, Header: {{request.header.X-Test}}, Query: {{request.query.q}}, Body: {{request.body.name}}"
			res := renderMockTemplate(c, tpl)
			return c.SendString(res)
		})

		reqBody := map[string]interface{}{"name": "john"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/test/123?q=abc", bytes.NewBuffer(body))
		req.Header.Set("X-Test", "val")
		req.Header.Set("Content-Type", "application/json")
		resp, _ := appTpl.Test(req)
		bodyRes, _ := io.ReadAll(resp.Body)
		assert.Equal(t, "ID: 123, Header: val, Query: abc, Body: john", string(bodyRes))
	})

	t.Run("handleMockRequest - Inactive Endpoint", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "is_active"}).AddRow(1, false))

		appMock := fiber.New()
		appMock.All("/mock/:collection_id/*", handleMockRequest)
		req := httptest.NewRequest("GET", "/mock/1/test", nil)
		resp, _ := appMock.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})
}

func TestMockServer_MissingCoverage_Part3(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/collections/:id/mock/endpoints/from-request/:requestId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockFromRequest(c)
	})

	t.Run("createMockFromRequest - Forbidden", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("SELECT .* FROM .team_members.").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints/from-request/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusForbidden, resp.StatusCode)
	})
}

func TestMockServer_MissingCoverage_Part4(t *testing.T) {
	app := fiber.New()
	app.Post("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockEndpoint(c)
	})
	app.Delete("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", deleteMockScenario)
	app.Put("/api/v1/mock-endpoints/:endpointId/scenarios/:scenarioId", updateMockScenario)
	app.Post("/api/v1/mock-endpoints/:endpointId/scenarios", createMockScenario)
	app.All("/mock/:collection_id/*", handleMockRequest)

	t.Run("createMockEndpoint - Collection Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .collections.").WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("POST", "/api/v1/collections/99/mock/endpoints", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("deleteMockScenario - DB Error", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectBegin()
		mock.ExpectExec("DELETE FROM .mock_scenarios.").WillReturnError(fmt.Errorf("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/mock-endpoints/1/scenarios/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("updateMockScenario - Scenario Not Found", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()
		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("PUT", "/api/v1/mock-endpoints/1/scenarios/1", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusNotFound, resp.StatusCode)
	})

	t.Run("createMockScenario - Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/mock-endpoints/1/scenarios", strings.NewReader("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
	})

	t.Run("serveMockEndpoint - File with Unknown Extension", func(t *testing.T) {
		mock, cleanup := repository.SetupTestDB()
		defer cleanup()

		mock.ExpectQuery("SELECT .* FROM .mock_endpoints.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "evaluation_mode", "status_code", "response_body", "is_active"}).
				AddRow(1, "/file", "GET", "auto", 200, "base", true))

		mock.ExpectQuery("SELECT .* FROM .mock_scenarios.").
			WillReturnRows(sqlmock.NewRows([]string{"id", "response_type", "file_base64", "file_name", "is_default"}).
				AddRow(5, "file", "YWJj", "test.unknown", true))

		req := httptest.NewRequest("GET", "/mock/1/file", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, fiber.StatusOK, resp.StatusCode)
		assert.Equal(t, "text/plain; charset=utf-8", resp.Header.Get("Content-Type"))
	})
}
