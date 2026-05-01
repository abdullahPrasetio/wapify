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

func TestListEnvironments(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/environments", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListEnvironments(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("^SELECT \\* FROM \"environments\" WHERE team_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "team_id"}).AddRow(1, "Prod", teamID))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/environments", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestCreateEnvironment(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/teams/:id/environments", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateEnvironment(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"environments\"").
			WithArgs("New Env", teamID, sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateEnvironmentRequest{
			Name:      "New Env",
			Variables: repository.JSONB{"baseUrl": "https://api.com"},
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/environments", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}
