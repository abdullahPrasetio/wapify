package repository

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSetupTestDB(t *testing.T) {
	mock, cleanup := SetupTestDB()
	defer cleanup()

	assert.NotNil(t, mock)
	assert.NotNil(t, DB)
}

func TestConnectDB_Error(t *testing.T) {
	// Set invalid environment variables to trigger error
	os.Setenv("DB_PORT", "invalid_port")
	defer os.Unsetenv("DB_PORT")

	err := ConnectDB()
	assert.Error(t, err)
}
