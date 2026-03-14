// Package service provides business logic and database operations.
package service

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// Service holds the database connection and provides business logic methods.
type Service struct {
	DB *gorm.DB
}

// New creates a new Service instance with the given database DSN.
func New(dsn string) (*Service, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	if err := db.AutoMigrate(&entity.User{}, &entity.Content{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	return &Service{DB: db}, nil
}
