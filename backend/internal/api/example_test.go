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

func TestCreateExample(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/requests/:id/examples", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateExample(c)
	})

	t.Run("Success", func(t *testing.T) {
		requestID := uint(1)
		collectionID := uint(10)
		teamID := uint(100)

		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(requestID, collectionID))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT .* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateExamplePayload{
			Name: "Success Case",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/requests/1/examples", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestUpdateExample(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/examples/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateExample(c)
	})

	t.Run("Success", func(t *testing.T) {
		exID := uint(1)
		reqID := uint(10)
		collectionID := uint(100)
		teamID := uint(1000)

		mock.ExpectQuery("^SELECT .* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(exID, reqID))

		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(reqID, collectionID))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT .* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"request_examples\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"name": "Updated"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/examples/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestDeleteExample(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/examples/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteExample(c)
	})

	t.Run("Success", func(t *testing.T) {
		exID := uint(1)
		reqID := uint(10)
		collectionID := uint(100)
		teamID := uint(1000)

		mock.ExpectQuery("^SELECT .* FROM \"request_examples\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id"}).AddRow(exID, reqID))

		mock.ExpectQuery("^SELECT .* FROM \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(reqID, collectionID))

		mock.ExpectQuery("^SELECT .* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT .* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"request_examples\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/examples/1", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
