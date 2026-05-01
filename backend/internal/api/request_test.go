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

func TestListRequestsInCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListRequestsInCollection(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		// 1. Mock Get Collection
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		// 2. Mock canAccessTeam check
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		// 3. Mock ListRequests
		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "method"}).
				AddRow(1, "Req 1", "GET"))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\" = \\$1").
			WithArgs(1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/requests", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestGetRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/requests/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return GetRequest(c)
	})

	t.Run("Success", func(t *testing.T) {
		requestID := uint(1)
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(requestID, collectionID))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\" = \\$1").
			WithArgs(1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs(collectionID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/requests/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestDeleteRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/requests/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteRequest(c)
	})

	t.Run("Success", func(t *testing.T) {
		requestID := uint(1)
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(requestID, collectionID))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs(collectionID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"requests\" WHERE .*id.* = \\$1").
			WithArgs(requestID).
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/requests/1", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestCreateRequestInCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/collections/:id/requests", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateRequestInCollection(c)
	})

	t.Run("Success_in_Collection", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(10)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := map[string]string{"name": "New Request", "method": "GET"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/requests", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

func TestMoveRequest(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Patch("/api/v1/requests/:id/move", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return MoveRequest(c)
	})

	t.Run("Success Same Collection", func(t *testing.T) {
		requestID := uint(1)
		collectionID := uint(10)
		teamID := uint(100)

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(requestID, collectionID))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs(collectionID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"requests\" SET").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := MoveRequestPayload{CollectionID: collectionID, FolderID: nil, OrderIndex: 5.0}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PATCH", "/api/v1/requests/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
