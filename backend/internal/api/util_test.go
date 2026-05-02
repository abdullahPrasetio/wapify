package api

import (
	"os"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func TestSyncUserSignatures(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()
	// Match expectations in order to ensure BEGIN/UPDATE/COMMIT sequence
	mock.MatchExpectationsInOrder(true)

	mock.ExpectQuery("SELECT .* FROM .users.").
		WillReturnRows(sqlmock.NewRows([]string{"id", "email", "is_super_admin", "role_signature"}).
			AddRow(1, "test@example.com", false, ""))

	mock.ExpectBegin()
	mock.ExpectExec("UPDATE .users. SET .* WHERE .id. = .*").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	SyncUserSignatures()

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCalculateRoleSignature_Fallback(t *testing.T) {
	os.Setenv("JWT_SECRET", "")
	sig := CalculateRoleSignature(1, "test@example.com", false)
	assert.NotEmpty(t, sig)
	
	os.Setenv("JWT_SECRET", "testsecret")
	sig2 := CalculateRoleSignature(1, "test@example.com", false)
	assert.NotEqual(t, sig, sig2)
}

func TestParseUint(t *testing.T) {
	assert.Equal(t, uint(123), parseUint("123"))
	assert.Equal(t, uint(0), parseUint("abc"))
	assert.Equal(t, uint(10), parseUint("10abc"))
}
