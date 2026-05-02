package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
)

func TestRequireAuth(t *testing.T) {
	app := fiber.New()
	os.Setenv("JWT_SECRET", "test_secret")
	defer os.Unsetenv("JWT_SECRET")

	app.Get("/test", RequireAuth, func(c *fiber.Ctx) error {
		return c.SendString("OK")
	})

	t.Run("Missing Header", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Format (No Bearer)", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "InvalidTokenString")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Invalid Token Signature", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(1),
		})
		tokenString, _ := token.SignedString([]byte("wrong_secret"))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Unexpected Signing Method", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"user_id": 1})
		tokenString, _ := token.SignedString(jwt.UnsafeAllowNoneSignatureType)

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Expired Token", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": float64(1),
			"exp":     time.Now().Add(-time.Hour).Unix(),
		})
		tokenString, _ := token.SignedString([]byte("test_secret"))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("Valid Token", func(t *testing.T) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id":        float64(1),
			"email":          "test@test.com",
			"is_super_admin": true,
			"exp":            time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := token.SignedString([]byte("test_secret"))

		req := httptest.NewRequest("GET", "/test", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestRequireSuperAdmin(t *testing.T) {
	t.Run("Access Denied - Not Admin", func(t *testing.T) {
		app := fiber.New()
		app.Get("/admin", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", false)
			return RequireSuperAdmin(c)
		})
		
		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Access Granted - Super Admin", func(t *testing.T) {
		app := fiber.New()
		app.Get("/admin", func(c *fiber.Ctx) error {
			c.Locals("is_super_admin", true)
			return RequireSuperAdmin(c)
		}, func(c *fiber.Ctx) error { return c.SendStatus(200) })
		
		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Access Denied - Missing Context", func(t *testing.T) {
		app := fiber.New()
		app.Get("/admin", RequireSuperAdmin)
		req := httptest.NewRequest("GET", "/admin", nil)
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
