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
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).AddRow(1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/teams/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("GET", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestListTeamMembers(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/members", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListTeamMembers(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "user_id"}).AddRow(1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/members", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found Team", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/teams/99/members", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("GET", "/api/v1/teams/1/members", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DB Error Members", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1").WillReturnError(errors.New("db error"))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/members", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestUpdateTeam(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/teams/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateTeam(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Old"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"teams\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"name": "New", "description": "New Desc"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PUT", "/api/v1/teams/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"teams\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := map[string]string{"name": "New"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"teams\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("DELETE", "/api/v1/teams/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden Viewer", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}))
		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Delete Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"teams\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Success SuperAdmin", func(t *testing.T) {
		appSA := fiber.New()
		appSA.Delete("/api/v1/teams/:id", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", true)
			return DeleteTeam(c)
		})
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"teams\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1", nil)
		resp, _ := appSA.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestAddTeamMember(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/teams/:id/members", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return AddTeamMember(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectCommit()

		reqBody := AddMemberRequest{UserID: 2, Role: "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Not Found Team", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/teams/99/members", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden Owner Role", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		reqBody := AddMemberRequest{UserID: 2, Role: "Owner"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Not Found User", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(errors.New("not found"))
		reqBody := AddMemberRequest{UserID: 99, Role: "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Conflict", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"teams\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"team_members\"").WillReturnError(errors.New("exists"))
		mock.ExpectRollback()

		reqBody := AddMemberRequest{UserID: 2, Role: "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/members", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusConflict, resp.StatusCode)
	})
}

func TestUpdateTeamMember(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/teams/:id/members/:userId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateTeamMember(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"team_members\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := UpdateMemberRequest{Role: "Viewer"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden Owner Role", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		reqBody := UpdateMemberRequest{Role: "Owner"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"team_members\"").WillReturnResult(sqlmock.NewResult(0, 0))
		mock.ExpectCommit()

		reqBody := UpdateMemberRequest{Role: "Viewer"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/99", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

func TestUpdateTeamMemberRole_Helper(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/teams/:id/members/:userId/role", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateTeamMemberRole(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"team_members\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"role": "Viewer"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2/role", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2/role", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2/role", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Update Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"team_members\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := map[string]string{"role": "Viewer"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2/role", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestRemoveTeamMember(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/teams/:id/members/:userId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return RemoveTeamMember(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"team_members\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1/members/2", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("DELETE", "/api/v1/teams/1/members/2", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"team_members\"").WillReturnResult(sqlmock.NewResult(0, 0))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1/members/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

func TestHelpers(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	
	t.Run("isEditorOrAbove SuperAdmin", func(t *testing.T) {
		app.Get("/test-sa", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", true)
			if isEditorOrAbove(c, 1) {
				return c.SendString("ok")
			}
			return c.SendStatus(403)
		})
		req := httptest.NewRequest("GET", "/test-sa", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("isEditorOrAbove User", func(t *testing.T) {
		app.Get("/test-user", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			c.Locals("user_id", float64(1))
			if isEditorOrAbove(c, 1) {
				return c.SendString("ok")
			}
			return c.SendStatus(403)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("GET", "/test-user", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("canAccessTeam SuperAdmin", func(t *testing.T) {
		app.Get("/test-ca-sa", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", true)
			if canAccessTeam(c, 1) {
				return c.SendString("ok")
			}
			return c.SendStatus(403)
		})
		req := httptest.NewRequest("GET", "/test-ca-sa", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
