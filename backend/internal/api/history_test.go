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

func TestSetupHistoryRoutes(t *testing.T) {
	app := fiber.New()
	SetupHistoryRoutes(app)
}

func TestGetTeamHistory(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/history", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return GetTeamHistory(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("^SELECT \\* FROM \"request_histories\"").
			WithArgs("1", 50).
			WillReturnRows(sqlmock.NewRows([]string{"id", "url", "user_id"}).AddRow(1, "http://api.test", userID))

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email"}).AddRow(userID, "test@test.com"))

		req := httptest.NewRequest("GET", "/api/v1/history?team_id=1", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Missing team_id", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/history", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("GET", "/api/v1/history?team_id=1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestCreateHistory(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/history", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateHistory(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(uint(1), uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"request_histories\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateHistoryRequest{
			TeamID: 1,
			URL:    "http://test.com",
			Method: "GET",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/history", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/history", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))
		reqBody := CreateHistoryRequest{TeamID: 10}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/history", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Create Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"request_histories\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		reqBody := CreateHistoryRequest{TeamID: 1}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/history", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestDeleteHistory(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/history/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return DeleteHistory(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_histories\"").
			WithArgs("1", uint(1)).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/history/1", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Delete Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_histories\"").WillReturnError(errors.New("delete error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/history/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestClearTeamHistory(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/history", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ClearTeamHistory(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(uint(1), uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_histories\"").
			WithArgs("1").
			WillReturnResult(sqlmock.NewResult(0, 5))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/history?team_id=1", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Missing team_id", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/history", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}))

		req := httptest.NewRequest("DELETE", "/api/v1/history?team_id=1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Clear Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_histories\"").WillReturnError(errors.New("clear error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/history?team_id=1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}
