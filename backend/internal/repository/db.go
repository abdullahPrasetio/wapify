package repository

import (
	"embed"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	migratepg "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

var DB *gorm.DB

func ConnectDB() error {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")
	port := os.Getenv("DB_PORT")

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable&TimeZone=Asia/Jakarta", user, password, host, port, dbname)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	DB = db
	log.Println("Connected to Database")

	if err := runMigrations(dsn, dbname); err != nil {
		return fmt.Errorf("migration failed: %w", err)
	}

	return nil
}

func runMigrations(dsn, dbname string) error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	driver, err := migratepg.WithInstance(sqlDB, &migratepg.Config{DatabaseName: dbname})
	if err != nil {
		return err
	}

	src, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return err
	}

	m, err := migrate.NewWithInstance("iofs", src, "postgres", driver)
	if err != nil {
		return err
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return err
	}

	log.Println("Database migrations applied")
	return nil
}
