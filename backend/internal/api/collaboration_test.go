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

func TestGetRequestVersions(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/requests/:id/versions", getRequestVersions)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT .* FROM \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "v1"))

		mock.ExpectQuery("^SELECT .* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1/versions", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetComments(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/requests/:id/comments", getComments)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT .* FROM \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "content"}).AddRow(1, "Nice!"))

		mock.ExpectQuery("^SELECT .* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1/comments", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
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
		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT .* FROM \"request_versions\"").
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

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
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
		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		
		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectQuery("^SELECT .* FROM \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "content"}).AddRow(1, "msg"))
		mock.ExpectQuery("^SELECT .* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]string{"content": "hi"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/1/comments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestDeleteComment(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/comments/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return deleteComment(c)
	})

	t.Run("Success", func(t *testing.T) {
		// Use VERY flexible regex for GORM queries
		mock.ExpectQuery("^SELECT .* FROM \"comments\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "user_id"}).AddRow(1, 10, 1))

		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(10, 100))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(100, 1000))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"comments\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/comments/1", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)
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
		mock.ExpectQuery("^SELECT .* FROM \"request_versions\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "method", "url"}).AddRow(100, "GET", "/v1"))

		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(10, 5))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(5, 1000))

		mock.ExpectBegin()
		// Mock ANY query or exec during Save (associations, etc)
		mock.ExpectQuery(".*").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(5))
		mock.ExpectExec("^UPDATE \"requests\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/requests/10/versions/100/rollback", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetActivities(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/activities", getActivities)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT .* FROM \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "action"}).AddRow(1, "TEST_ACTION"))

		mock.ExpectQuery("^SELECT .* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/activities", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
