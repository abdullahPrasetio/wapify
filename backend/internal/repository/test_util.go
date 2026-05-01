package repository

import (
	"database/sql"
	"log"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// SetupTestDB initializes a mock database for testing purposes.
// It returns the mock object to set expectations and a cleanup function.
func SetupTestDB() (sqlmock.Sqlmock, func()) {
	var (
		db  *sql.DB
		mock sqlmock.Sqlmock
		err  error
	)

	db, mock, err = sqlmock.New()
	if err != nil {
		log.Fatalf("failed to open sqlmock: %v", err)
	}

	dialector := postgres.New(postgres.Config{
		Conn: db,
	})

	gormDB, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to open gorm: %v", err)
	}

	// Override global DB
	DB = gormDB

	cleanup := func() {
		db.Close()
	}

	return mock, cleanup
}
