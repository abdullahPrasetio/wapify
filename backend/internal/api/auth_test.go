package api

import (
	"bytes"
	"encoding/json"
	"errors"
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

func TestSetupAuthRoutes(t *testing.T) {
	app := fiber.New()
	SetupAuthRoutes(app)
}

func TestLogin(t *testing.T) {
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
		Name:         "Test User",
	}
	user.RoleSignature = CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin)

	t.Run("Success Login", func(t *testing.T) {
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature", "name"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, user.RoleSignature, user.Name)
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		loginReq := LoginRequest{Email: user.Email, Password: password}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Success Login - Empty Signature", func(t *testing.T) {
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature", "name"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, "", user.Name)
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		loginReq := LoginRequest{Email: user.Email, Password: password}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/login", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
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

func TestChangePassword(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/change-password", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return ChangePassword(c)
	})

	t.Run("Success", func(t *testing.T) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("old-pass"), bcrypt.DefaultCost)
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(1, string(hash)))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"users\"").WillReturnResult(sqlmock.NewResult(1, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{"old_password": "old-pass", "new_password": "new-pass"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("New Password Too Short", func(t *testing.T) {
		// Validasi min. 8 karakter berjalan sebelum query DB apa pun.
		reqBody := map[string]string{"old_password": "old-pass", "new_password": "short"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("User Not Found", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(errors.New("not found"))
		reqBody := map[string]string{"old_password": "old-pass", "new_password": "new-pass-123"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("Incorrect Old Password", func(t *testing.T) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("correct-old"), bcrypt.DefaultCost)
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(1, string(hash)))

		reqBody := map[string]string{"old_password": "WRONG", "new_password": "new-pass-123"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Bcrypt Error", func(t *testing.T) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("old-pass"), bcrypt.DefaultCost)
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(1, string(hash)))

		// Password too long for bcrypt (> 72 bytes)
		longPass := "a"
		for i := 0; i < 100; i++ {
			longPass += "a"
		}

		reqBody := map[string]string{"old_password": "old-pass", "new_password": longPass}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("Save Error", func(t *testing.T) {
		hash, _ := bcrypt.GenerateFromPassword([]byte("old-pass"), bcrypt.DefaultCost)
		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(1, string(hash)))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"users\"").WillReturnError(errors.New("save error"))
		mock.ExpectRollback()

		reqBody := map[string]string{"old_password": "old-pass", "new_password": "new-pass"}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})
}

func TestRefresh(t *testing.T) {
	os.Setenv("JWT_SECRET", "test_secret")
	defer os.Unsetenv("JWT_SECRET")

	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/refresh", Refresh)

	t.Run("Success", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(1),
			"exp":     time.Now().Add(time.Hour).Unix(),
		})
		rt, _ := token.SignedString([]byte("test_secret"))

		user := repository.User{
			ID:           1,
			Email:        "test@test.com",
			IsSuperAdmin: false,
		}
		user.RoleSignature = CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin)

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WithArgs(uint(1), 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "is_super_admin", "role_signature"}).
				AddRow(user.ID, user.Email, user.IsSuperAdmin, user.RoleSignature))

		reqBody := map[string]string{"refresh_token": rt}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req, -1)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Invalid Body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBufferString("invalid"))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

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

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").WillReturnError(errors.New("not found"))

		reqBody := map[string]string{"refresh_token": rt}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Integrity Violation", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(1),
			"exp":     time.Now().Add(time.Hour).Unix(),
		})
		rt, _ := token.SignedString([]byte("test_secret"))

		mock.ExpectQuery("^SELECT \\* FROM \"users\"").
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "is_super_admin", "role_signature"}).
				AddRow(1, "test@test.com", false, "TAMPERED"))

		reqBody := map[string]string{"refresh_token": rt}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestLogout(t *testing.T) {
	app := fiber.New()
	app.Post("/logout", Logout)

	req := httptest.NewRequest("POST", "/logout", nil)
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
}
