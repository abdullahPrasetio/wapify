package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestRequestRoutes(t *testing.T) {
	app := fiber.New()
	SetupRequestRoutes(app)
	assert.NotEmpty(t, app.GetRoutes())
}

func TestListRequestsInFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Get("/api/v1/folders/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListRequestsInFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "R1"))
		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(1, 1))

		req := httptest.NewRequest("GET", "/api/v1/folders/1/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Folder Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/folders/99/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"})) // No rows = forbidden

		req := httptest.NewRequest("GET", "/api/v1/folders/1/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestListRequestsInCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Get("/api/v1/collections/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListRequestsInCollection(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "R1"))
		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(1, 1))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/collections/99/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/requests", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestCreateRequestInFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Post("/api/v1/folders/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateRequestInFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "New Req",
			"headers": map[string]interface{}{"Content-Type": "application/json"},
			"body": map[string]interface{}{"foo": "bar"},
			"auth_config": map[string]interface{}{"type": "bearer"},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/folders/1/requests", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Success Array Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "New Req",
			"body": []interface{}{map[string]interface{}{"key": "k", "value": "v"}},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/folders/1/requests", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("POST", "/api/v1/folders/1/requests", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("POST", "/api/v1/folders/1/requests", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestCreateRequestInCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Post("/api/v1/collections/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateRequestInCollection(c)
	})

	t.Run("Success with folder_id", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "New Req",
			"folder_id": float64(5),
			"headers": map[string]interface{}{"H": "V"},
			"body": map[string]interface{}{"B": "V"},
			"auth_config": map[string]interface{}{"A": "V"},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/requests", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Success Array Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "New Req",
			"body": []interface{}{map[string]interface{}{"key": "k", "value": "v"}},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/requests", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/collections/99/requests", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		req := httptest.NewRequest("POST", "/api/v1/collections/1/requests", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("POST", "/api/v1/collections/1/requests", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestGetRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Get("/api/v1/requests/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return GetRequest(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(1, 1))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/requests/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(1, 1))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/requests/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestUpdateRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Put("/api/v1/requests/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateRequest(c)
	})

	t.Run("Success Full", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "name"}).AddRow(1, 10, "Old"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "New Name",
			"method": "POST",
			"url": "http://new.com",
			"headers": map[string]interface{}{"h": "v"},
			"body": map[string]interface{}{"b": "v"},
			"body_type": "json",
			"auth_config": map[string]interface{}{"a": "v"},
			"pre_request_script": "pre",
			"post_request_script": "post",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success Array Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"body": []interface{}{map[string]interface{}{"key": "k", "value": "v"}},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PUT", "/api/v1/requests/99", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Activity Log Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnError(errors.New("log error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode) // Should still be 200
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Success Partial Empty", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "name"}).AddRow(1, 10, "Old"))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]interface{}{
			"name": "", // Should skip update
			"method": "", // Should skip update
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("PUT", "/api/v1/requests/1", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestDeleteRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Delete("/api/v1/requests/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteRequest(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "name"}).AddRow(1, 10, "R1"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"requests\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/requests/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("DELETE", "/api/v1/requests/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"})) // Empty = forbidden

		req := httptest.NewRequest("DELETE", "/api/v1/requests/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/requests/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestDuplicateRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Post("/api/v1/requests/:id/duplicate", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DuplicateRequest(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "name"}).AddRow(1, 10, "R1"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/requests/1/duplicate", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/requests/99/duplicate", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("POST", "/api/v1/requests/1/duplicate", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("POST", "/api/v1/requests/1/duplicate", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestMoveRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Patch("/api/v1/requests/:id/move", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return MoveRequest(c)
	})

	t.Run("Success Same Collection", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		payload := MoveRequestPayload{CollectionID: 10, FolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success Different Collection", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		// Target collection
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(20, 200))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		payload := MoveRequestPayload{CollectionID: 20, FolderID: nil, OrderIndex: 2.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Request Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PATCH", "/api/v1/requests/99/move", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBufferString("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Target Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))

		payload := MoveRequestPayload{CollectionID: 99, FolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Target Collection Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(20, 200))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		payload := MoveRequestPayload{CollectionID: 20, FolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		payload := MoveRequestPayload{CollectionID: 10, FolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestRequestHelpers(t *testing.T) {
	data := map[string]interface{}{
		"s": "string",
		"i": float64(10),
		"f": float64(1.5),
	}

	assert.Equal(t, "string", getString(data, "s"))
	assert.Equal(t, "", getString(data, "none"))
	
	assert.Equal(t, 10, getInt(data, "i"))
	assert.Equal(t, 0, getInt(data, "none"))

	assert.Equal(t, 1.5, getFloat64(data, "f"))
	assert.Equal(t, 0.0, getFloat64(data, "none"))
}
