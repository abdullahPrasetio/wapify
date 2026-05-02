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

func TestSetupTeamRoutes(t *testing.T) {
	app := fiber.New()
	SetupTeamRoutes(app)
}

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

		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Missing Name", func(t *testing.T) {
		reqBody := CreateTeamRequest{Name: ""}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Create Team Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"teams\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		reqBody := CreateTeamRequest{Name: "Fail"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Create Member Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnError(errors.New("db error"))
		mock.ExpectRollback()

		reqBody := CreateTeamRequest{Name: "Fail Member"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestListTeams(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	t.Run("Success Normal User", func(t *testing.T) {
		app := fiber.New()
		app.Get("/api/v1/teams", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return ListTeams(c)
		})

		userID := uint(1)
		mock.ExpectQuery("^SELECT .* FROM \"teams\" JOIN team_members").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Team 1"))

		req := httptest.NewRequest("GET", "/api/v1/teams", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success SuperAdmin", func(t *testing.T) {
		app := fiber.New()
		app.Get("/api/v1/teams", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", true)
			return ListTeams(c)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Team 1").AddRow(2, "Team 2"))

		req := httptest.NewRequest("GET", "/api/v1/teams", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error Normal User", func(t *testing.T) {
		app := fiber.New()
		app.Get("/api/v1/teams", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return ListTeams(c)
		})

		mock.ExpectQuery("^SELECT .* FROM \"teams\" JOIN team_members").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/teams", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("DB Error SuperAdmin", func(t *testing.T) {
		app := fiber.New()
		app.Get("/api/v1/teams", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", true)
			return ListTeams(c)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/teams", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}
