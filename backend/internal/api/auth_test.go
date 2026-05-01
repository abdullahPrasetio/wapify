package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func TestLogin(t *testing.T) {
	// Setup
	os.Setenv("JWT_SECRET", "test_secret")
	defer os.Unsetenv("JWT_SECRET")

	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/login", Login)

	password := "password123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	
	user := repository.User{
		ID:           1,
		Email:        "test@example.com",
		PasswordHash: string(hash),
		IsSuperAdmin: false,
	}
	user.RoleSignature = CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin)

	t.Run("Success Login", func(t *testing.T) {
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, user.RoleSignature)
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		loginReq := LoginRequest{Email: user.Email, Password: password}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid Credentials - Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs("wrong@test.com", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"}))

		loginReq := LoginRequest{Email: "wrong@test.com", Password: "any"}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Credentials - Wrong Password", func(t *testing.T) {
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, user.RoleSignature)
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		loginReq := LoginRequest{Email: user.Email, Password: "wrong-password"}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Account Integrity Violation", func(t *testing.T) {
		// Mock user with TAMPERED signature
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, "TAMPERED_SIG")
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		loginReq := LoginRequest{Email: user.Email, Password: password}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestChangePassword_Errors(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/auth/change-password", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return ChangePassword(c)
	})

	t.Run("Incorrect Old Password", func(t *testing.T) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("correct-old"), bcrypt.DefaultCost)
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(1, string(hash)))

		reqBody := map[string]string{"old_password": "WRONG", "new_password": "new"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/auth/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Database Error", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(http.ErrServerClosed)

		reqBody := map[string]string{"old_password": "any", "new_password": "any"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/auth/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

func TestRefresh_Errors(t *testing.T) {
	os.Setenv("JWT_SECRET", "test_secret")
	defer os.Unsetenv("JWT_SECRET")

	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/refresh", Refresh)

	t.Run("Invalid Token Format", func(t *testing.T) {
		reqBody := map[string]string{"refresh_token": "not.a.jwt.token"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("User Not Found", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(99),
			"exp":     time.Now().Add(time.Hour).Unix(),
		})
		rt, _ := token.SignedString([]byte("test_secret"))

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnRows(sqlmock.NewRows([]string{"id"}))

		reqBody := map[string]string{"refresh_token": rt}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}
