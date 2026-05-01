package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestGetCollectionDocs(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/docs", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return getCollectionDocs(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock loadCollectionTree
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name"}).AddRow(collectionID, teamID, "My API"))

		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Folder A"))

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "method", "url"}).
				AddRow(1, "Get Users", "GET", "/users"))
		
		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\" = \\$1").
			WithArgs(1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		// 2. Mock canAccessTeam check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var doc DocResponse
		json.NewDecoder(resp.Body).Decode(&doc)
		assert.Equal(t, "My API", doc.CollectionName)
		assert.Len(t, doc.Folders, 1)
		assert.Equal(t, "Folder A", doc.Folders[0].Name)
	})
}
