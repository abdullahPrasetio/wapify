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

func TestListAllUsers(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/admin/users", ListAllUsers)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "name"}).
				AddRow(1, "admin@test.com", "Admin").
				AddRow(2, "user@test.com", "User"))

		req := httptest.NewRequest("GET", "/api/v1/admin/users", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestCreateUser(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/admin/users", CreateUser)

	t.Run("Success with Team", func(t *testing.T) {
		reqBody := CreateUserRequest{
			Name:         "New User",
			Email:        "new@test.com",
			Password:     "pass123",
			IsSuperAdmin: false,
			TeamID:       1,
		}

		mock.ExpectBegin()
		// 1. Create User
		mock.ExpectQuery("^INSERT INTO \"users\"").
			WithArgs(reqBody.Email, sqlmock.AnyArg(), reqBody.Name, reqBody.IsSuperAdmin, sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		
		// 2. UPDATE User (for role signature)
		mock.ExpectExec("^UPDATE \"users\" SET").
			WillReturnResult(sqlmock.NewResult(0, 1))
		
		// 3. Assign to Team
		mock.ExpectQuery("^INSERT INTO \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
			
		mock.ExpectCommit()

		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestDeleteUser(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/admin/users/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1)) // Current user is ID 1
		return DeleteUser(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"users\" WHERE \"users\"\\.\"id\" = \\$1").
			WithArgs("2").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/admin/users/2", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Self Delete Forbidden", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/admin/users/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestAdminAddTeamMember(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/admin/teams/:id/members", AdminAddTeamMember)

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(2)

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").
			WithArgs(teamID, userID, "Editor", sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE .*id.* = \\$1").
			WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "user_id"}).AddRow(1, teamID, userID))
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email"}).AddRow(userID, "user@test.com"))

		reqBody := map[string]interface{}{"user_id": userID, "role": "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestListAllTeams(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/admin/teams", ListAllTeams)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Team A"))

		req := httptest.NewRequest("GET", "/api/v1/admin/teams", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
