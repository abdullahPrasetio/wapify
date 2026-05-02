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

func TestSetupCollaborationRoutes(t *testing.T) {
	app := fiber.New()
	SetupCollaborationRoutes(app)
}

func TestGetRequestVersions(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/requests/:id/versions", getRequestVersions)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "v1"))

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1/versions", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/requests/1/versions", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestGetComments(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/requests/:id/comments", getComments)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "content"}).AddRow(1, "Nice!"))

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1/comments", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/requests/1/comments", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestCreateRequestVersion(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/requests/:id/versions", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return createRequestVersion(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]string{"name": "v1"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/1/versions", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Request Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/requests/99/versions", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Create Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))
		
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"request_versions\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("POST", "/api/v1/requests/1/versions", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestRollbackRequestVersion(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/requests/:id/versions/:version_id/rollback", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return rollbackRequestVersion(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "method", "url"}).AddRow(100, "GET", "/v1"))

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/requests/1/versions/100/rollback", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Version Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/requests/1/versions/999/rollback", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Request Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(100))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/requests/99/versions/100/rollback", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"request_versions\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(100))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("POST", "/api/v1/requests/1/versions/100/rollback", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestCreateComment(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/requests/:id/comments", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return createComment(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectQuery("^SELECT \\* FROM \"comments\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "content"}).AddRow(1, "msg"))
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]string{"content": "hi"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/1/comments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/requests/1/comments", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Request Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnError(errors.New("not found"))
		reqBody := map[string]string{"content": "hi"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/99/comments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Create Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"comments\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := map[string]string{"content": "hi"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/1/comments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestDeleteComment(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/comments/:comment_id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return deleteComment(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "user_id"}).AddRow(1, 1, 1))

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"comments\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/comments/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("DELETE", "/api/v1/comments/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).AddRow(1, 99))
		req := httptest.NewRequest("DELETE", "/api/v1/comments/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Delete Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"comments\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "user_id"}).AddRow(1, 1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"comments\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/comments/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Success SuperAdmin", func(t *testing.T) {
		appSA := fiber.New()
		appSA.Delete("/api/v1/comments/:comment_id", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(2)) // Different user
			c.Locals("is_super_admin", true)
			return deleteComment(c)
		})
		mock.ExpectQuery("^SELECT \\* FROM \"comments\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "user_id"}).AddRow(1, 1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"comments\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/comments/1", nil)
		resp, _ := appSA.Test(req, -1)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	})
}

func TestGetActivities(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/activities", getActivities)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"activity_logs\" WHERE team_id = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "action"}).AddRow(1, "TEST_ACTION"))

		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE \"users\"\\.\"id\" = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/activities", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"activity_logs\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/teams/1/activities", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}
