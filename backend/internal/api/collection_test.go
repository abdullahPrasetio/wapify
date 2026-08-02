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
	"github.com/stretchr/testify/require"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"gorm.io/gorm"
)

func TestSetupCollectionRoutes(t *testing.T) {
	app := fiber.New()
	SetupCollectionRoutes(app)
}

func TestPostmanParamsToFields(t *testing.T) {
	fields := postmanParamsToFields([]PostmanFormParam{
		{Key: "grant_type", Value: "client_credentials", Type: "text"},
		{Key: "disabled_field", Value: "x", Type: "text", Disabled: true},
		{Key: "upload", Value: "", Type: "file"},
	})

	assert.Equal(t, []map[string]interface{}{
		{"key": "grant_type", "value": "client_credentials", "enabled": true, "type": "text"},
		{"key": "disabled_field", "value": "x", "enabled": false, "type": "text"},
		{"key": "upload", "value": "", "enabled": true, "type": "file"},
	}, fields)
}

func TestResolvePostmanBody(t *testing.T) {
	t.Run("nil body defaults to raw-json", func(t *testing.T) {
		body, bodyType := resolvePostmanBody(nil)
		assert.Nil(t, body)
		assert.Equal(t, "raw-json", bodyType)
	})

	t.Run("raw mode parses JSON", func(t *testing.T) {
		body, bodyType := resolvePostmanBody(&PostmanBody{Mode: "raw", Raw: `{"a":1}`})
		assert.Equal(t, map[string]interface{}{"a": float64(1)}, body)
		assert.Equal(t, "raw-json", bodyType)
	})

	t.Run("urlencoded mode maps to KeyValueEditor rows", func(t *testing.T) {
		body, bodyType := resolvePostmanBody(&PostmanBody{
			Mode: "urlencoded",
			URLEncoded: []PostmanFormParam{
				{Key: "username", Value: "temancode", Type: "text"},
			},
		})
		assert.Equal(t, "x-www-form-urlencoded", bodyType)
		assert.Equal(t, map[string]interface{}{
			"array": []map[string]interface{}{
				{"key": "username", "value": "temancode", "enabled": true, "type": "text"},
			},
		}, body)
	})

	t.Run("formdata mode maps to KeyValueEditor rows", func(t *testing.T) {
		body, bodyType := resolvePostmanBody(&PostmanBody{
			Mode: "formdata",
			FormData: []PostmanFormParam{
				{Key: "avatar", Type: "file"},
			},
		})
		assert.Equal(t, "form-data", bodyType)
		assert.Equal(t, map[string]interface{}{
			"array": []map[string]interface{}{
				{"key": "avatar", "value": "", "enabled": true, "type": "file"},
			},
		}, body)
	})
}

func TestListCollections(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/teams/:id/collections", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ListCollections(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE team_id = \\$1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(1, "Coll 1"))

		req := httptest.NewRequest("GET", "/api/v1/teams/1/collections", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("GET", "/api/v1/teams/1/collections", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("DB Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("db error"))
		req := httptest.NewRequest("GET", "/api/v1/teams/1/collections", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
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
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{Name: "New", Description: "Desc"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/collections", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("POST", "/api/v1/teams/1/collections", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		req := httptest.NewRequest("POST", "/api/v1/teams/1/collections", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Create Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := CreateCollectionRequest{Name: "Fail"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/api/v1/teams/1/collections", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestGetCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return GetCollection(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("GET", "/api/v1/collections/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("GET", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestUpdateCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/collections/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return UpdateCollection(c)
	})

	t.Run("Success - Both Name and Description", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).AddRow(1, 10, "Old", "Old Desc"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"collections\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{Name: "New Name", Description: "New Desc"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success - Name Only", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).AddRow(1, 10, "Old", "Old Desc"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"collections\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{Name: "New Name"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success - Description Only", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).AddRow(1, 10, "Old", "Old Desc"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"collections\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{Description: "New Desc"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("PUT", "/api/v1/collections/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name"}).AddRow(1, 10, "Old"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"collections\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		reqBody := CreateCollectionRequest{Name: "New"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Overwrites settings fields and defaults nil auth_config/variables to empty object", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).AddRow(1, 10, "Old", "Old Desc"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"collections\" SET").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		reqBody := CreateCollectionRequest{
			Name:             "New",
			PreRequestScript: "wap.collectionVariables.set('x', '1')",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/collections/1", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var updated repository.Collection
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&updated))
		assert.Equal(t, "wap.collectionVariables.set('x', '1')", updated.PreRequestScript)
		// Omitted JSONB fields normalize to {} rather than JSON null.
		assert.Equal(t, repository.JSONB{}, updated.AuthConfig)
		assert.Equal(t, repository.JSONB{}, updated.Variables)
	})
}

func TestDeleteCollection(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Delete("/api/v1/collections/:id", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return DeleteCollection(c)
	})

	t.Run("Success", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name"}).AddRow(1, 10, "Coll"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"collections\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		req := httptest.NewRequest("DELETE", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(errors.New("not found"))
		req := httptest.NewRequest("DELETE", "/api/v1/collections/99", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 10))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("DELETE", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Delete Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name"}).AddRow(1, 10, "Coll"))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))
		mock.ExpectBegin()
		mock.ExpectExec("^DELETE FROM \"collections\"").WillReturnError(errors.New("fail"))
		mock.ExpectRollback()

		req := httptest.NewRequest("DELETE", "/api/v1/collections/1", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestImportPostman(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/api/v1/teams/:id/import", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return ImportPostman(c)
	})

	t.Run("Success Full", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectQuery("^INSERT INTO \"folders\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(100))
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(101))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		postmanJSON := `{
			"info": {"name": "Postman Coll", "description": "Imported"},
			"item": [
				{"name": "Folder", "item": [{"name": "Req1", "request": {"method": "GET", "url": "h"}}]},
				{"name": "Req2", "request": {"method": "POST", "url": {"raw": "h2"}, "header": [{"key": "K", "value": "V"}], "body": {"mode": "raw", "raw": "{\"a\":1}"}}}
			]
		}`

		req := httptest.NewRequest("POST", "/api/v1/teams/1/import", bytes.NewBufferString(postmanJSON))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
	})

	t.Run("Auth/Variables/Scripts mapping + unsupported auth count", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(2))
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(200))
		mock.ExpectCommit()

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"activity_logs\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		// Collection-level: bearer auth (supported) + variables + prerequest/test scripts.
		// Request-level: oauth2 (unsupported — should be skipped, not silently kept as-is).
		postmanJSON := `{
			"info": {"name": "Auth Coll"},
			"auth": {"type": "bearer", "bearer": [{"key": "token", "value": "{{collToken}}"}]},
			"variable": [{"key": "clientid", "value": "abc"}, {"key": "count", "value": 3}],
			"event": [
				{"listen": "prerequest", "script": {"exec": ["console.log('coll pre')"]}},
				{"listen": "test", "script": {"exec": ["pm.test('coll test', () => {})"]}}
			],
			"item": [
				{
					"name": "OAuthReq",
					"request": {
						"method": "GET",
						"url": "http://x",
						"auth": {"type": "oauth2", "oauth2": [{"key": "accessTokenUrl", "value": "http://token"}]}
					},
					"event": [{"listen": "test", "script": {"exec": ["pm.test('req test', () => {})"]}}]
				}
			]
		}`

		req := httptest.NewRequest("POST", "/api/v1/teams/1/import", bytes.NewBufferString(postmanJSON))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var body struct {
			CollectionID         uint `json:"collection_id"`
			UnsupportedAuthCount int  `json:"unsupported_auth_count"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		assert.Equal(t, uint(2), body.CollectionID)
		assert.Equal(t, 1, body.UnsupportedAuthCount) // the oauth2 request, collection's own bearer auth is supported
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		req := httptest.NewRequest("POST", "/api/v1/teams/1/import", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("BodyParser Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("POST", "/api/v1/teams/1/import", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("Transaction/Create Collection Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"collections\"").WillReturnError(errors.New("db fail"))
		mock.ExpectRollback()

		postmanJSON := `{"info": {"name": "Test"}}`
		req := httptest.NewRequest("POST", "/api/v1/teams/1/import", bytes.NewBufferString(postmanJSON))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestProcessPostmanItems_Additional(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	t.Run("URL as Object without Raw", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{
				{
					Name: "R",
					Request: &PostmanReq{
						Method: "GET",
						URL:    map[string]interface{}{"host": "example.com"}, // No "raw"
					},
				},
			}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.NoError(t, err)
	})

	t.Run("URL as Other Type", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{
				{
					Name: "R",
					Request: &PostmanReq{
						Method: "GET",
						URL:    123, // Unexpected type
					},
				},
			}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.NoError(t, err)
	})

	t.Run("Request with Invalid JSON Raw Body", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
		mock.ExpectCommit()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{
				{
					Name: "R",
					Request: &PostmanReq{
						Method: "POST",
						Body:   &PostmanBody{Mode: "raw", Raw: "not json"},
					},
				},
			}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.NoError(t, err) // json.Unmarshal error is ignored in code
	})

	t.Run("Recursive Folder Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"folders\"").WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(10))
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnError(errors.New("recursive fail"))
		mock.ExpectRollback()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{
				{
					Name: "Folder",
					Item: []PostmanItem{
						{Name: "Req", Request: &PostmanReq{Method: "GET"}},
					},
				},
			}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.Error(t, err)
		assert.Equal(t, "recursive fail", err.Error())
	})

	t.Run("Folder Create Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"folders\"").WillReturnError(errors.New("fail folder"))
		mock.ExpectRollback()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{{Name: "F", Item: []PostmanItem{{Name: "Sub"}}}}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.Error(t, err)
	})

	t.Run("Request Create Error", func(t *testing.T) {
		mock.ExpectBegin()
		mock.ExpectQuery("^INSERT INTO \"requests\"").WillReturnError(errors.New("fail req"))
		mock.ExpectRollback()

		err := repository.DB.Transaction(func(tx *gorm.DB) error {
			items := []PostmanItem{{Name: "R", Request: &PostmanReq{Method: "GET"}}}
			count := 0
			return processPostmanItems(tx, items, 1, nil, 1, &count)
		})
		assert.Error(t, err)
	})
}
