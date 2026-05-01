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
		// Mock DB expectations
		rows := sqlmock.NewRows([]string{"id", "email", "password_hash", "is_super_admin", "role_signature"}).
			AddRow(user.ID, user.Email, user.PasswordHash, user.IsSuperAdmin, user.RoleSignature)
		
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs(user.Email, 1).
			WillReturnRows(rows)

		// Create request
		loginReq := LoginRequest{
			Email:    user.Email,
			Password: password,
		}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		// Execute
		resp, err := app.Test(req)

		// Assert
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		assert.NotEmpty(t, result["token"])
		assert.NotEmpty(t, result["refresh_token"])
		
		userMap := result["user"].(map[string]interface{})
		assert.Equal(t, user.Email, userMap["email"])
	})

	t.Run("Invalid Credentials", func(t *testing.T) {
		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE email = \\$1").
			WithArgs("wrong@example.com", 1).
			WillReturnRows(sqlmock.NewRows([]string{"id"})) // Empty result

		loginReq := LoginRequest{
			Email:    "wrong@example.com",
			Password: "wrongpassword",
		}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/login", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)

		assert.NoError(t, err)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

func TestChangePassword(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Put("/api/v1/auth/change-password", func(c *fiber.Ctx) error {
		c.Locals("user_id", float64(1))
		return ChangePassword(c)
	})

	t.Run("Success", func(t *testing.T) {
		userID := uint(1)
		oldPassword := "old-pass"
		newPassword := "new-pass"
		hash, _ := bcrypt.GenerateFromPassword([]byte(oldPassword), bcrypt.DefaultCost)

		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WithArgs(userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "password_hash"}).AddRow(userID, string(hash)))

		mock.ExpectBegin()
		mock.ExpectExec("^UPDATE \"users\" SET").WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectCommit()

		reqBody := map[string]string{
			"old_password": oldPassword,
			"new_password": newPassword,
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("PUT", "/api/v1/auth/change-password", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestLogout(t *testing.T) {
	app := fiber.New()
	app.Post("/logout", Logout)

	req := httptest.NewRequest("POST", "/logout", nil)
	resp, _ := app.Test(req)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
}

func TestRefresh(t *testing.T) {
	os.Setenv("JWT_SECRET", "test_secret")
	defer os.Unsetenv("JWT_SECRET")

	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	app := fiber.New()
	app.Post("/refresh", Refresh)

	t.Run("Valid Refresh", func(t *testing.T) {
		userID := uint(1)
		email := "test@test.com"
		
		// Create a valid refresh token
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(userID),
			"exp":     time.Now().Add(time.Hour).Unix(),
		})
		rt, _ := token.SignedString([]byte("test_secret"))

		user := repository.User{
			ID:           userID,
			Email:        email,
			IsSuperAdmin: false,
		}
		user.RoleSignature = CalculateRoleSignature(user.ID, user.Email, user.IsSuperAdmin)

		mock.ExpectQuery("^SELECT \\* FROM \"users\" WHERE .*id.* = \\$1").
			WithArgs(userID, 1).
			WillReturnRows(sqlmock.NewRows([]string{"id", "email", "role_signature"}).
				AddRow(user.ID, user.Email, user.RoleSignature))

		reqBody := map[string]string{"refresh_token": rt}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/refresh", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}
