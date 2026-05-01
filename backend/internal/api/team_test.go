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

func TestCreateTeam(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/teams", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return CreateTeam(c)
	})

	t.Run("Success", func(t *testing.T) {
		userID := uint(1)

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"teams\"").
			WithArgs("New Team", "Desc", userID, sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").
			WithArgs(uint(1), userID, "Owner", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateTeamRequest{
			Name:        "New Team",
			Description: "Desc",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Missing Name", func(t *testing.T) {
		reqBody := CreateTeamRequest{Name: ""}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestListTeams(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListTeams(c)
	})

	t.Run("Success", func(t *testing.T) {
		userID := uint(1)

		mock.ExpectQuery("^SELECT \"teams\"\\.\"id\"").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Team 1"))

		req := httptest.NewRequest("GET", "/api/v1/teams", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetTeamDetail(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return GetTeamDetail(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"teams\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(teamID, "My Team"))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1").
			WithArgs(teamID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).AddRow(1, userID))
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(userID))

		req := httptest.NewRequest("GET", "/api/v1/teams/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/teams/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

func TestDeleteTeam(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/teams/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteTeam(c)
	})

	t.Run("Success as Owner", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"teams\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role = 'Owner'").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"teams\" WHERE .*id.* = \\$1").WithArgs(teamID).WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden as Viewer", func(t *testing.T) {
		teamID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(teamID))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"})) // Not Owner

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
