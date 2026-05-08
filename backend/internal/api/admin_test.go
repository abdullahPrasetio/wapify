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

func TestSetupAdminRoutes(t *testing.T) {
	app := fiber.New()
	SetupAdminRoutes(app)
}

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
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/admin/users", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
			Role:         "Viewer",
		}

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, -1)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Success with Team Default Role", func(t *testing.T) {
		reqBody := CreateUserRequest{
			Name:     "Default Role User",
			Email:    "def@test.com",
			Password: "pass",
			TeamID:   1,
		}

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(3))
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnResult(sqlmock.NewResult(3, 1))
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectCommit()

		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, -1)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Success without Team", func(t *testing.T) {
		reqBody := CreateUserRequest{
			Name:     "No Team User",
			Email:    "noteam@test.com",
			Password: "pass",
		}

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnResult(sqlmock.NewResult(2, 1))
		mock.ExpectCommit()

		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, -1)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Bcrypt Error", func(t *testing.T) {
		longPass := "a"
		for i := 0; i < 100; i++ {
			longPass += "a"
		}
		reqBody := CreateUserRequest{Password: longPass}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Transaction Error - Create User", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := CreateUserRequest{Name: "X", Email: "x@x.com", Password: "p"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Transaction Error - Save User", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnError(errors.New("fail save"))
		mock.ExpectRollback()

		reqBody := CreateUserRequest{Name: "X", Email: "x@x.com", Password: "p"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Transaction Error - Create Member", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnError(errors.New("fail member"))
		mock.ExpectRollback()

		reqBody := CreateUserRequest{Name: "X", Email: "x@x.com", Password: "p", TeamID: 1}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/users", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/admin/teams", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "user_id"}).AddRow(1, teamID, userID))
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email"}).AddRow(userID, "user@test.com"))

		reqBody := map[string]interface{}{"user_id": userID, "role": "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, -1)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/v1/admin/teams/1/members", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden Owner Role", func(t *testing.T) {
		reqBody := map[string]interface{}{"user_id": 2, "role": "Owner"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Conflict/DB Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnError(errors.New("exists"))
		mock.ExpectRollback()

		reqBody := map[string]interface{}{"user_id": 2, "role": "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/admin/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
	})
}

func TestAdminRemoveTeamMember(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/admin/teams/:id/members/:userId", AdminRemoveTeamMember)

	t.Run("Success", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"team_members\"").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/admin/teams/1/members/2", nil)
		resp, err := app.Test(req, -1)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"team_members\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/admin/teams/1/members/2", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Self Delete Forbidden", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/admin/users/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"users\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/admin/users/3", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}
