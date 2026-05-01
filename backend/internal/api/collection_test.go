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

func TestListCollections(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/collections", func(c *fiber.Ctx) error {
		// Mock auth locals
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListCollections(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock canAccessTeam check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "user_id"}).AddRow(1, teamID, userID))

		// 2. Mock ListCollections query
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE team_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "team_id"}).
				AddRow(1, "Collection 1", teamID).
				AddRow(2, "Collection 2", teamID))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/collections", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var collections []repository.Collection
		json.NewDecoder(resp.Body).Decode(&collections)
		assert.Len(t, collections, 2)
		assert.Equal(t, "Collection 1", collections[0].Name)
	})

	t.Run("Forbidden", func(t *testing.T) {
		teamID := uint(2)
		userID := uint(1)

		// Mock canAccessTeam check - record not found
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/teams/2/collections", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestCreateCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/teams/:id/collections", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateCollection(c)
	})

	t.Run("Success", func(t *testing.T) {
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock isEditorOrAbove check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		// 2. Mock Create Collection
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").
			WithArgs("New Coll", "Desc", teamID, userID, sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		// 3. Mock LogActivity
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WithArgs(teamID, userID, "CREATED_COLLECTION", "COLLECTION", 1, sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{
			Name:        "New Coll",
			Description: "Desc",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/collections", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}
