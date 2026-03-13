package service

import (
	"errors"
	"fmt"

	"gorm.io/gorm"

	"github.com/miclle/niubility/internal/entity"
)

// GetUserByUsername retrieves a user by username.
func (s *Service) GetUserByUsername(username string) (*entity.User, error) {
	var user entity.User
	if err := s.DB.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by username: %w", err)
	}
	return &user, nil
}

// GetUserByID retrieves a user by ID.
func (s *Service) GetUserByID(id string) (*entity.User, error) {
	var user entity.User
	if err := s.DB.Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &user, nil
}

// ListUsers retrieves a paginated list of users.
func (s *Service) ListUsers(args entity.ListUsersArgs) ([]entity.User, int64, error) {
	var users []entity.User
	var total int64

	query := s.DB.Model(&entity.User{})

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	if err := query.Offset(args.Offset()).Limit(args.GetLimit()).Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}

	return users, total, nil
}

// CreateUser creates a new user record.
func (s *Service) CreateUser(user *entity.User) error {
	user.ID = entity.ID()
	if err := s.DB.Create(user).Error; err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// UpdateUser updates user fields by ID.
func (s *Service) UpdateUser(id string, args entity.UpdateUserArgs) (*entity.User, error) {
	user, err := s.GetUserByID(id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	updates := map[string]any{}
	if args.Role != nil {
		updates["role"] = *args.Role
	}
	if args.Status != nil {
		updates["status"] = *args.Status
	}

	if len(updates) > 0 {
		if err := s.DB.Model(user).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("update user: %w", err)
		}
	}

	return user, nil
}
