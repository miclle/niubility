package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/fox-gonic/fox/logger"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
	apperrors "github.com/miclle/niubility/internal/errors"
)

// InitSuperAdmin creates the initial super admin user and marks the system as initialized.
func (s *Service) InitSuperAdmin(ctx context.Context, username, email, password string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	if s.IsInitialized(ctx) {
		return nil, fmt.Errorf("system is already initialized")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Errorf("hash password: %v", err)
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &entity.User{
		ID:       entity.ID(),
		Username: username,
		Name:     username,
		Email:    email,
		Password: string(hashed),
		Role:     entity.RoleSuperAdmin,
		Status:   entity.UserStatusActivated,
	}

	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		log.Errorf("create super admin: %v", err)
		return nil, fmt.Errorf("create super admin: %w", err)
	}

	// Mark system as initialized
	if err := s.SetSetting(ctx, entity.SettingInitialized, "true"); err != nil {
		log.Errorf("set initialized flag: %v", err)
		return nil, fmt.Errorf("set initialized flag: %w", err)
	}

	return user, nil
}

// RegisterUser creates a new user account with password. New users default to deactivated status.
func (s *Service) RegisterUser(ctx context.Context, username, email, password string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	// Check if username already exists
	existing, err := s.GetUserByUsername(ctx, username)
	if err != nil {
		log.Errorf("check existing user: %v", err)
		return nil, fmt.Errorf("check existing user: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("username already exists")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Errorf("hash password: %v", err)
		return nil, fmt.Errorf("hash password: %w", err)
	}

	name, _, ok := strings.Cut(email, "@")
	if !ok {
		name = username
	}

	user := &entity.User{
		ID:       entity.ID(),
		Username: username,
		Name:     name,
		Email:    email,
		Password: string(hashed),
		Role:     entity.RoleUser,
		Status:   entity.UserStatusDeactivated,
	}

	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		log.Errorf("create user: %v", err)
		return nil, fmt.Errorf("create user: %w", err)
	}

	return user, nil
}

// AuthenticateUser verifies a username and password, returning the user if valid.
func (s *Service) AuthenticateUser(ctx context.Context, username, password string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	var user entity.User
	if err := s.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("invalid username or password")
		}
		log.Errorf("get user: %v", err)
		return nil, fmt.Errorf("get user: %w", err)
	}

	if user.Password == "" {
		return nil, fmt.Errorf("invalid username or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid username or password")
	}

	return &user, nil
}

// HasPassword checks if the user has a password set.
func (s *Service) HasPassword(ctx context.Context, userID string) (bool, error) {
	log := logger.NewWithContext(ctx)

	var password string
	err := s.db.WithContext(ctx).Model(&entity.User{}).Where("id = ?", userID).Pluck("password", &password).Error
	if err != nil {
		log.Errorf("check user password: %v", err)
		return false, fmt.Errorf("check user password: %w", err)
	}
	return password != "", nil
}

// ChangePassword verifies the old password and sets a new password for the user.
func (s *Service) ChangePassword(ctx context.Context, userID, oldPassword, newPassword string) error {
	log := logger.NewWithContext(ctx)

	var user entity.User
	if err := s.db.WithContext(ctx).Where("id = ?", userID).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("user not found")
		}
		log.Errorf("get user: %v", err)
		return fmt.Errorf("get user: %w", err)
	}

	// If user has an existing password, verify the old password
	if user.Password != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
			return apperrors.ErrOldPasswordIncorrect
		}
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Errorf("hash password: %v", err)
		return fmt.Errorf("hash password: %w", err)
	}

	if err := s.db.WithContext(ctx).Model(&user).Update("password", string(hashed)).Error; err != nil {
		log.Errorf("update password: %v", err)
		return fmt.Errorf("update password: %w", err)
	}

	return nil
}
