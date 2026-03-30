package config

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDatabase() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	// PreferSimpleProtocol disables pgx prepared statements — required for
	// PgBouncer in transaction pooling mode (pgbouncer=true in DATABASE_URL).
	// PrepareStmt: false disables GORM's own prepared statement cache.
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{
		PrepareStmt: false,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Schema is managed by Prisma — no AutoMigrate here
	DB = db
	log.Println("Database connected successfully")
}
