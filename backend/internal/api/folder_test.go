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

func TestSetupFolderRoutes(t *testing.T) {
	app := fiber.New()
	SetupFolderRoutes(app)
}

func TestMoveFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Patch("/api/v1/folders/:id/move", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return MoveFolder(c)
	})

	t.Run("Success Same Collection", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		payload := MoveFolderPayload{CollectionID: 10, ParentFolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success Different Collection", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		// Target collection check
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(20, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		payload := MoveFolderPayload{CollectionID: 20, ParentFolderID: nil, OrderIndex: 1.0}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Folder Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PATCH", "/api/v1/folders/99/move", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden Source", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Move Into Itself", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		parentID := uint(1)
		payload := MoveFolderPayload{ParentFolderID: &parentID}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Target Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))

		payload := MoveFolderPayload{CollectionID: 20}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Forbidden Target", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(20, 200))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		payload := MoveFolderPayload{CollectionID: 20}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnError(errors.New("save error"))
		mock.ExpectRollback()

		payload := MoveFolderPayload{CollectionID: 10}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest("PATCH", "/api/v1/folders/1/move", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestListFolders(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/folders", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListFolders(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Folder 1"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/folders", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/collections/99/folders", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/folders", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestCreateFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/collections/:id/folders", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return CreateFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE .*id.* = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\" WHERE team_id = \\$1 AND user_id = \\$2 AND role IN").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateFolderRequest{Name: "New Folder"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/folders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Collection Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/collections/99/folders", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("POST", "/api/v1/collections/1/folders", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("POST", "/api/v1/collections/1/folders", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Create Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"folders\"").WillReturnError(errors.New("create error"))
		mock.ExpectRollback()

		reqBody := CreateFolderRequest{Name: "Fail"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/collections/1/folders", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestUpdateFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/folders/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id", "name"}).AddRow(1, 10, "Old"))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateFolderRequest{Name: "New"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/folders/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Folder Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PUT", "/api/v1/folders/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("PUT", "/api/v1/folders/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("PUT", "/api/v1/folders/1", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnError(errors.New("save error"))
		mock.ExpectRollback()

		reqBody := CreateFolderRequest{Name: "New"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/folders/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestDeleteFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/folders/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		folderID := uint(1)
		collectionID := uint(10)
		teamID := uint(100)

		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(folderID, collectionID))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(collectionID, teamID))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"folders\"").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/folders/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Folder Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("DELETE", "/api/v1/folders/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("DELETE", "/api/v1/folders/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Delete Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"folders\"").WillReturnError(errors.New("delete error"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/folders/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestDuplicateFolder(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	mock.MatchExpectationsInOrder(false)

	app := fiber.New()
	app.Post("/api/v1/folders/:id/duplicate", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DuplicateFolder(c)
	})

	t.Run("Success", func(t *testing.T) {
		// Handler fetch + duplicateFolderTree's own fetch of the same folder.
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "collection_id", "parent_folder_id", "order_index"}).AddRow(1, "F", 10, nil, 0))
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "collection_id", "parent_folder_id", "order_index"}).AddRow(1, "F", 10, nil, 0))

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectCommit()

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE folder_id").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE parent_folder_id").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"folders\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("POST", "/api/v1/folders/1/duplicate", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("POST", "/api/v1/folders/99/duplicate", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "collection_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(10, 100))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("POST", "/api/v1/folders/1/duplicate", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
