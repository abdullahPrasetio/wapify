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
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock Get Team (ListTeamMembers calls First(&team, teamID))
		mock.ExpectQuery("^SELECT \\* FROM \"teams\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(teamID))

		// 2. Mock canAccessTeam check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		// 3. Mock ListTeamMembers query
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1").
			WithArgs(teamID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "user_id"}).AddRow(1, teamID, userID))

		// 4. Mock Preload User
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email"}).AddRow(userID, "test@test.com"))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/members", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var members []repository.TeamMember
		json.NewDecoder(resp.Body).Decode(&members)
		assert.Len(t, members, 1)
	})
}

func TestUpdateTeamMemberRole(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/teams/:id/members/:userId", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateTeamMemberRole(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		currentUserID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, currentUserID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"team_members\" SET").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"role": "Editor"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/teams/1/members/2", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
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
		teamID := uint(1)
		currentUserID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, currentUserID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Owner"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/teams/1/members/2", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
