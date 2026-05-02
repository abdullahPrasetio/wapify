package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestDocumentationHelpers(t *testing.T) {
	t.Run("extractURLPath", func(t *testing.T) {
		assert.Equal(t, "/api/v1/users", extractURLPath("http://localhost:8080/api/v1/users"))
		assert.Equal(t, "/api/v1/users", extractURLPath("https://api.example.com/api/v1/users?q=1"))
		assert.Equal(t, "/users/{id}", extractURLPath("/users/{{id}}"))
		assert.Equal(t, "/", extractURLPath("http://example.com"))
		assert.Equal(t, "/", extractURLPath(""))
		assert.Equal(t, "/path", extractURLPath("example.com/path"))
		assert.Equal(t, "/", extractURLPath("http://example.com/"))
		assert.Equal(t, "/", extractURLPath("localhost"))
	})

	t.Run("sanitizeFilename", func(t *testing.T) {
		assert.Equal(t, "My_API_File", sanitizeFilename("My API File"))
		assert.Equal(t, "API_v1_0_", sanitizeFilename("API v1.0!"))
		assert.Equal(t, "test-file_123", sanitizeFilename("test-file_123"))
	})

	t.Run("sortedKeys", func(t *testing.T) {
		m := map[string]interface{}{
			"c": 3,
			"a": 1,
			"b": 2,
		}
		assert.Equal(t, []string{"a", "b", "c"}, sortedKeys(m))
	})
}

func TestSetupDocumentationRoutes(t *testing.T) {
	app := fiber.New()
	SetupDocumentationRoutes(app)

	routes := app.GetRoutes()
	expectedRoutes := []string{
		"/api/v1/collections/:id/docs",
		"/api/v1/collections/:id/docs/markdown",
		"/api/v1/collections/:id/docs/swagger",
	}

	for _, er := range expectedRoutes {
		found := false
		for _, r := range routes {
			if r.Path == er && r.Method == "GET" {
				found = true
				break
			}
		}
		assert.True(t, found, "Route %s not found", er)
	}
}

func TestGetCollectionDocs_Comprehensive(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/docs", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return getCollectionDocs(c)
	})

	t.Run("CollectionNotFound", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs("999", 1).
			WillReturnError(fmt.Errorf("not found"))

		req := httptest.NewRequest("GET", "/api/v1/collections/999/docs", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		collectionID := "1"
		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs(collectionID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").
			WithArgs(collectionID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))
		
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").
			WithArgs(collectionID).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(1, 1, 1).
			WillReturnError(fmt.Errorf("not member"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Success_ComplexTree", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).
				AddRow(collectionID, teamID, "Complex API", "API Desc"))

		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "collection_id", "parent_folder_id"}).
				AddRow(10, "Parent Folder", collectionID, nil).
				AddRow(11, "Child Folder", collectionID, nil))

		orphanFolderID := uint(99)
		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "method", "url", "folder_id", "headers", "body"}).
				AddRow(100, "Root Req", "GET", "/root", nil, []byte("{}"), []byte("{}")).
				AddRow(101, "Folder Req", "POST", "/folder", &orphanFolderID, []byte("{}"), []byte("{}")))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "request_id", "name"}).
				AddRow(1, 101, "Example 1"))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs", nil)
		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var doc DocResponse
		json.NewDecoder(resp.Body).Decode(&doc)
		assert.Equal(t, "Complex API", doc.CollectionName)
	})
}

func TestExportMarkdown_Comprehensive(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/docs/markdown", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", false)
		return exportMarkdown(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)
		userID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).
				AddRow(collectionID, teamID, "Markdown API", "Markdown Desc"))

		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(10, "Folder A"))

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "method", "url", "folder_id", "headers", "body"}).
				AddRow(100, "Req A", "GET", "/a", nil, []byte("{}"), []byte("{}")))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(teamID, userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs/markdown", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("NotFound", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(fmt.Errorf("not found"))
		req := httptest.NewRequest("GET", "/api/v1/collections/999/docs/markdown", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnError(fmt.Errorf("not member"))
		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs/markdown", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestExportSwagger_Comprehensive(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Get("/api/v1/collections/:id/docs/swagger", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		c.Locals("is_super_admin", true)
		return exportSwagger(c)
	})

	t.Run("Success", func(t *testing.T) {
		collectionID := uint(1)
		teamID := uint(1)

		mock.ExpectQuery("^SELECT \\* FROM \"collections\" WHERE \"collections\"\\.\"id\" = \\$1").
			WithArgs("1", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "team_id", "name", "description"}).
				AddRow(collectionID, teamID, "Swagger API", "Swagger Desc"))

		mock.ExpectQuery("^SELECT \\* FROM \"folders\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow(10, "Folder A"))

		mock.ExpectQuery("^SELECT \\* FROM \"requests\" WHERE collection_id = \\$1").
			WithArgs("1").
			WillReturnRows(sqlmock.NewRows([]string{"id", "name", "method", "url", "folder_id", "headers", "body"}).
				AddRow(100, "Req A", "GET", "/a", nil, []byte("{}"), []byte("{}")))

		mock.ExpectQuery("^SELECT \\* FROM \"request_examples\" WHERE \"request_examples\"\\.\"request_id\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs/swagger", nil)
		resp, err := app.Test(req, -1)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("NotFound", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnError(fmt.Errorf("not found"))
		req := httptest.NewRequest("GET", "/api/v1/collections/999/docs/swagger", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Forbidden", func(t *testing.T) {
		// Override app for this test to set is_super_admin=false
		appForbidden := fiber.New()
		appForbidden.Get("/api/v1/collections/:id/docs/swagger", func(c *fiber.Ctx) error {
			c.Locals("user_id", float64(1))
			c.Locals("is_super_admin", false)
			return exportSwagger(c)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"collections\"").WillReturnRows(sqlmock.NewRows([]string{"id", "team_id"}).AddRow(1, 1))
		mock.ExpectQuery("^SELECT \\* FROM \"folders\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("^SELECT \\* FROM \"requests\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))
		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").WillReturnError(fmt.Errorf("not member"))

		req := httptest.NewRequest("GET", "/api/v1/collections/1/docs/swagger", nil)
		resp, _ := appForbidden.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestGenerateMarkdown_Details(t *testing.T) {
	folderID := uint(1)
	tree := &collectionTree{
		Collection: repository.Collection{Name: "Test", Description: "Desc"},
		Folders: []repository.Folder{
			{ID: folderID, Name: "Folder1"},
		},
		Requests: []repository.Request{
			{
				ID: 1, Name: "Req1", Method: "GET", URL: "/r1", FolderID: &folderID,
				Headers: repository.JSONB{"H1": "V1"},
				Body:    repository.JSONB{"B1": "V1"},
			},
			{
				ID: 2, Name: "Req2", Method: "POST", URL: "/r2",
			},
		},
	}

	md := generateMarkdown(tree)
	assert.Contains(t, md, "# Test")
	assert.Contains(t, md, "## 📁 Folder1")
	assert.Contains(t, md, "## General")
}

func TestGenerateSwagger_Details(t *testing.T) {
	folderID := uint(1)
	tree := &collectionTree{
		Collection: repository.Collection{Name: "Test", Description: "Desc"},
		Folders: []repository.Folder{
			{ID: folderID, Name: "Folder1"},
		},
		Requests: []repository.Request{
			{
				ID: 1, Name: "Req1", Method: "PUT", URL: "http://example.com/api/{{id}}", FolderID: &folderID,
				Headers: repository.JSONB{"H1": "V1"},
				Body:    repository.JSONB{"B1": "V1"},
				Description: "Req Desc",
			},
		},
	}

	spec := generateSwagger(tree)
	assert.Equal(t, "Test", spec.Info.Title)
	path := "/api/{id}"
	assert.Contains(t, spec.Paths, path)
}

func uintPtr(u uint) *uint {
	return &u
}

func TestDocumentation_ExtraEdgeCases(t *testing.T) {
	t.Run("extractURLPath - Extra Variations", func(t *testing.T) {
		assert.Equal(t, "/", extractURLPath("http://host?q=1"))
		assert.Equal(t, "/", extractURLPath("http://host"))
		assert.Equal(t, "/path", extractURLPath("http://host/path?q=1"))
		assert.Equal(t, "/", extractURLPath("http:host"))
		assert.Equal(t, "/", extractURLPath(""))
		assert.Equal(t, "/", extractURLPath("http://"))
	})

	t.Run("buildDocResponse - Nested Folders", func(t *testing.T) {
		tree := &collectionTree{
			Collection: repository.Collection{ID: 1, Name: "Col"},
			Folders: []repository.Folder{
				{ID: 10, Name: "Parent"},
				{ID: 11, Name: "Child", ParentFolderID: uintPtr(10)},
			},
			Requests: []repository.Request{
				{ID: 100, Name: "R1", FolderID: uintPtr(11)},
			},
		}
		doc := buildDocResponse(tree)
		assert.Equal(t, 2, len(doc.Folders))
		// Check that Child folder has ParentID 10
		foundChild := false
		for _, f := range doc.Folders {
			if f.ID == 11 {
				assert.Equal(t, uint(10), *f.ParentID)
				assert.Equal(t, 1, len(f.Requests))
				foundChild = true
			}
		}
		assert.True(t, foundChild)
	})

	t.Run("generateMarkdown - With and Without Description", func(t *testing.T) {
		tree := &collectionTree{
			Collection: repository.Collection{Name: "Col", Description: "Col Desc"},
			Requests: []repository.Request{
				{Name: "R1", Method: "GET", URL: "/", Description: "Req Desc"},
				{Name: "R2", Method: "GET", URL: "/"},
			},
		}
		md := generateMarkdown(tree)
		assert.Contains(t, md, "# Col")
		assert.Contains(t, md, "Col Desc")
		assert.Contains(t, md, "Req Desc")
	})

	t.Run("buildDocResponse - Request with invalid FolderID", func(t *testing.T) {
		fid := uint(999)
		tree := &collectionTree{
			Collection: repository.Collection{ID: 1, Name: "Test"},
			Folders:    []repository.Folder{{ID: 1, Name: "F1"}},
			Requests:   []repository.Request{{ID: 1, Name: "R1", FolderID: &fid}},
		}
		doc := buildDocResponse(tree)
		assert.Len(t, doc.Folders[0].Requests, 0)
	})

	t.Run("toDocRequest - Nil Headers and Body", func(t *testing.T) {
		r := repository.Request{
			Name: "Nil Data",
		}
		dr := toDocRequest(r)
		assert.NotNil(t, dr.Headers)
		assert.NotNil(t, dr.Body)
		assert.Equal(t, 0, len(dr.Headers))
	})

	t.Run("toDocRequest - Non-Nil Headers and Body", func(t *testing.T) {
		r := repository.Request{
			Name:    "Full Data",
			Headers: repository.JSONB{"Content-Type": "application/json", "X-Test": "Value"},
			Body:    repository.JSONB{"key": "value", "nested": map[string]interface{}{"a": 1}},
		}
		dr := toDocRequest(r)
		assert.Equal(t, 2, len(dr.Headers))
		assert.Equal(t, 2, len(dr.Body))
		assert.Equal(t, "application/json", dr.Headers["Content-Type"])
		assert.Equal(t, "value", dr.Body["key"])
	})

	t.Run("buildDocResponse - Folder without Requests", func(t *testing.T) {
		tree := &collectionTree{
			Collection: repository.Collection{ID: 1, Name: "Col"},
			Folders: []repository.Folder{
				{ID: 10, Name: "Empty Folder"},
			},
			Requests: []repository.Request{},
		}
		doc := buildDocResponse(tree)
		assert.Equal(t, 1, len(doc.Folders))
		assert.Equal(t, 0, len(doc.Folders[0].Requests))
	})
}
