package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestListMockEndpoints(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return listMockEndpoints(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock Get Collection
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		// 2. Mock canAccessTeam check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		// 3. Mock listMockEndpoints query
		mock.ExpectQuery("^SELECT \\* FROM \"mock_endpoints\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method"}).AddRow(1, "/test", "GET"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/mock/endpoints", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var endpoints []repository.MockEndpoint
		json.NewDecoder(resp.Body).Decode(&endpoints)
		assert.Len(t, endpoints, 1)
		assert.Equal(t, "/test", endpoints[0].Path)
	})
}

func TestCreateMockEndpoint(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/collections/:id/mock/endpoints", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockEndpoint(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"mock_endpoints\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"method": "GET",
			"path":   "/api/v1/test",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/mock/endpoints", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestUpdateMockEndpoint(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/collections/:id/mock/endpoints/:endpointId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return updateMockEndpoint(c)
	})

	t.Run("Success", func(t *testing.T) {
		endpointID := uint(1)
		collectionID := uint(10)
		teamID := uint(100)

		mock.ExpectQuery("^SELECT \\* FROM \"mock_endpoints\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(endpointID, collectionID))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("10", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"mock_endpoints\" SET").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"path": "/new-path"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/10/mock/endpoints/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestDeleteMockEndpoint(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/collections/:id/mock/endpoints/:endpointId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return deleteMockEndpoint(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(10)
		teamID := uint(100)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("10", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"mock_endpoints\" WHERE .*id.* = \\$1").WithArgs("1").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/collections/10/mock/endpoints/1", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})
}

func TestCreateMockScenario(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/mock-endpoints/:endpointId/scenarios", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return createMockScenario(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"mock_scenarios\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{"name": "Scenario 1", "status_code": 200}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/mock-endpoints/1/scenarios", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestHandleMockRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.All("/mock/:collection_id/*", handleMockRequest)

	t.Run("Matched Root Path", func(t *testing.T) {
		collectionID := "1"
		
		mock.ExpectQuery("^SELECT \\* FROM \"mock_endpoints\" WHERE collection_id = \\$1 AND is_active = true AND method = \\$2").
			WithArgs(collectionID, "GET").
			WillReturnRows(sqlmock.NewRows([]string{"id", "path", "method", "status_code", "response_body", "evaluation_mode"}).
				AddRow(1, "/", "GET", 200, "{\"ok\": true}", "auto"))

		// Mock Preload/Find scenarios in serveMockEndpoint
		mock.ExpectQuery("^SELECT \\* FROM \"mock_scenarios\" WHERE mock_endpoint_id = \\$1").
			WithArgs(uint(1)).
			WillReturnRows(sqlmock.NewRows([]string{"id", "mock_endpoint_id", "is_default"}).
				AddRow(1, uint(1), true))

		req := httptest.NewRequest("GET", "/mock/1/", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestMatchPath(t *testing.T) {
	tests := []struct {
		pattern  string
		incoming string
		expected bool
	}{
		{"/", "/", true},
		{"/users", "/users", true},
		{"/users/{id}", "/users/123", true},
		{"/users/{id}/profile", "/users/456/profile", true},
		{"/users/{id}", "/posts/123", false},
		{"/users/{id}", "/users/123/extra", false},
	}

	for _, tt := range tests {
		t.Run(tt.pattern+"_"+tt.incoming, func(t *testing.T) {
			assert.Equal(t, tt.expected, matchPath(tt.pattern, tt.incoming))
		})
	}
}

func TestCompareValues(t *testing.T) {
	tests := []struct {
		name      string
		reqVal    interface{}
		op        string
		targetVal interface{}
		expected  bool
	}{
		{"Equals Success", "123", "equals", "123", true},
		{"Equals Fail", "456", "equals", "123", false},
		{"Contains Success", "abcdef", "contains", "abc", true},
		{"Regex Success", "12345", "regex", "^[0-9]+$", true},
		{"Regex Fail", "123a45", "regex", "^[0-9]+$", false},
		{"Exists Success", "some-val", "exists", nil, true},
		{"Exists Fail", nil, "exists", nil, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, compareValues(tt.reqVal, tt.op, tt.targetVal))
		})
	}
}
