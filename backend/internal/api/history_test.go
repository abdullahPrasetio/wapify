package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

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

		mock.ExpectQuery("^SELECT \\* FROM \"request_histories\" WHERE team_id = \\$1").
			WithArgs("1", 50).
			WillReturnRows(sqlmock.NewRows([]string{"id", "url"}).AddRow(1, "http://api.test"))

		// Mock Preload User
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE \"users\"\\.\"id\" = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email"}).AddRow(userID, "test@test.com"))

		req := httptest.NewRequest("GET", "/api/v1/history?team_id=1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
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
		mock.ExpectExec("^DELETE FROM \"request_histories\" WHERE id = \\$1 AND user_id = \\$2").
			WithArgs("1", uint(1)).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/history/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestClearTeamHistory(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/history", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", true) // So it passes isAdminOrAbove
		return ClearTeamHistory(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_histories\" WHERE team_id = \\$1").
			WithArgs("1").
			WillReturnResult(sqlmock.NewResult(0, 5))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/history?team_id=1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

