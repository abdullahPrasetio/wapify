package db

import (
	"fmt"
	"os"

	"github.com/rs/zerolog/log"
	"github.com/waluyo/wapbolt-license-server/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect opens a PostgreSQL connection using DATABASE_URL env and runs auto-migration.
func Connect() error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = buildDSN()
	}

	conn, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect to postgres: %w", err)
	}

	if err := conn.AutoMigrate(&model.LicenseRequest{}, &model.InstanceRating{}); err != nil {
		return fmt.Errorf("auto-migrate failed: %w", err)
	}

	DB = conn
	log.Info().Msg("Connected to PostgreSQL")
	return nil
}

func buildDSN() string {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	pass := getEnv("DB_PASSWORD", "")
	name := getEnv("DB_NAME", "wapbolt_licenses")
	sslmode := getEnv("DB_SSLMODE", "disable")
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", host, port, user, pass, name, sslmode)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
