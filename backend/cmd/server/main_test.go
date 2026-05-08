package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestPrepareServer(t *testing.T) {
	// Setup mock DB to prevent nil pointer during SyncUserSignatures or routes setup
	_, cleanup := repository.SetupTestDB()
	defer cleanup()

	os.Setenv("GO_ENV", "test")
	defer os.Unsetenv("GO_ENV")

	app, addr, err := PrepareServer()
	assert.NoError(t, err)
	assert.NotNil(t, app)
	assert.Equal(t, ":8000", addr)

	t.Run("Health Check", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/", nil)
		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("Custom Port", func(t *testing.T) {
		os.Setenv("PORT", "9000")
		defer os.Unsetenv("PORT")
		_, addr, _ := PrepareServer()
		assert.Equal(t, ":9000", addr)
	})
}
