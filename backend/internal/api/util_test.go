package api

import (
	"testing"
	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"net/http/httptest"
)

func TestParseUint(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected uint
	}{
		{"Valid positive number", "123", 123},
		{"Single digit", "5", 5},
		{"String with characters trailing", "123abc", 123},
		{"Empty string", "", 0},
		{"Characters only", "abc", 0},
		{"String with mixed characters", "1a2b3", 123},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseUint(tt.input)
			if result != tt.expected {
				t.Errorf("parseUint(%q) = %d; want %d", tt.input, result, tt.expected)
			}
		})
	}
}

func TestCalculateRoleSignature(t *testing.T) {
	userID := uint(1)
	email := "test@example.com"
	isSuperAdmin := true

	sig1 := CalculateRoleSignature(userID, email, isSuperAdmin)
	sig2 := CalculateRoleSignature(userID, email, isSuperAdmin)

	if sig1 == "" {
		t.Errorf("CalculateRoleSignature returned empty string")
	}

	if sig1 != sig2 {
		t.Errorf("CalculateRoleSignature is not deterministic: %q != %q", sig1, sig2)
	}

	sig3 := CalculateRoleSignature(uint(2), email, isSuperAdmin)
	if sig1 == sig3 {
		t.Errorf("CalculateRoleSignature returned same signature for different userID")
	}

	sig4 := CalculateRoleSignature(userID, "other@example.com", isSuperAdmin)
	if sig1 == sig4 {
		t.Errorf("CalculateRoleSignature returned same signature for different email")
	}
}

func TestSyncUserSignatures(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	t.Run("Sync Required", func(t *testing.T) {
		// Mock Find all users
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "is_super_admin", "role_signature"}).
				AddRow(1, "u1@test.com", true, "").      // No signature
				AddRow(2, "u2@test.com", false, "valid")) // Has signature

		// Expect 1 update for user 1
		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"users\" SET").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		SyncUserSignatures()

		assert.NoError(t, mock.ExpectationsWereMet())
	})
}

func TestIsAdminOrAbove(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()

	t.Run("Super Admin", func(t *testing.T) {
		app.Get("/test-sa", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", true)
			if isAdminOrAbove(c, 1) {
				return c.SendStatus(200)
			}
			return c.SendStatus(403)
		})
		
		req := httptest.NewRequest("GET", "/test-sa", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("Team Admin", func(t *testing.T) {
		app.Get("/test-ta", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			c.Locals("user_id", float64(1))
			if isAdminOrAbove(c, 10) {
				return c.SendStatus(200)
			}
			return c.SendStatus(403)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(uint(10), uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Admin"))

		req := httptest.NewRequest("GET", "/test-ta", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, 200, resp.StatusCode)
	})

	t.Run("Denied", func(t *testing.T) {
		app.Get("/test-denied", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			c.Locals("user_id", float64(1))
			if isAdminOrAbove(c, 10) {
				return c.SendStatus(200)
			}
			return c.SendStatus(403)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WillReturnRows(sqlmock.NewRows([]string{"id"})) // Not found

		req := httptest.NewRequest("GET", "/test-denied", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, 403, resp.StatusCode)
	})
}

func TestIsEditorOrAbove(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()

	t.Run("Editor Success", func(t *testing.T) {
		app.Get("/test-editor", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			c.Locals("user_id", float64(1))
			if isEditorOrAbove(c, 10) {
				return c.SendStatus(200)
			}
			return c.SendStatus(403)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(uint(10), uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Editor"))

		req := httptest.NewRequest("GET", "/test-editor", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, 200, resp.StatusCode)
	})
}

func TestCanAccessTeam(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()

	t.Run("Viewer Success", func(t *testing.T) {
		app.Get("/test-viewer", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			c.Locals("user_id", float64(1))
			if canAccessTeam(c, 10) {
				return c.SendStatus(200)
			}
			return c.SendStatus(403)
		})

		mock.ExpectQuery("^SELECT \\* FROM \"team_members\"").
			WithArgs(uint(10), uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "role"}).AddRow(1, "Viewer"))

		req := httptest.NewRequest("GET", "/test-viewer", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, 200, resp.StatusCode)
	})
}
