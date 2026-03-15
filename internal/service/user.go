package service

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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

// UpsertUser creates a new user or updates the existing one by username.
// The first user is automatically set as admin. New users default to activated status.
// It also syncs user info from WeChat if available.
func (s *Service) UpsertUser(username, email string) (*entity.User, error) {
	name, _, ok := strings.Cut(email, "@")
	if !ok {
		name = username
	}

	// first user becomes admin
	role := entity.RoleUser
	var count int64
	if err := s.DB.Model(&entity.User{}).Count(&count).Error; err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	if count == 0 {
		role = entity.RoleAdmin
	}

	user := &entity.User{
		ID:       entity.ID(),
		Username: username,
		Name:     name,
		Email:    email,
		Role:     role,
		Status:   entity.UserStatusActivated,
	}

	// Try to sync user info from WeChat before creating
	if s.Wechat != nil {
		if info, err := s.Wechat.GetUser(username); err == nil {
			user.Name = info.Name
			user.Mobile = info.Mobile
			user.Avatar = info.AvatarURL
		}
	}

	conds := clause.OnConflict{
		Columns:   []clause.Column{{Name: "username"}},
		DoUpdates: clause.AssignmentColumns([]string{"email", "name", "mobile", "avatar"}),
	}
	if err := s.DB.Clauses(conds).Create(user).Error; err != nil {
		return nil, fmt.Errorf("upsert user: %w", err)
	}

	// reload to get the actual record (in case it was an existing user)
	return s.GetUserByUsername(username)
}

// SyncUserFromWechat syncs user info from WeChat by username.
func (s *Service) SyncUserFromWechat(username string) (*entity.User, error) {
	fmt.Printf("[WeChat Sync] Starting sync for username: %s\n", username)

	user, err := s.GetUserByUsername(username)
	if err != nil {
		fmt.Printf("[WeChat Sync] Error getting user: %v\n", err)
		return nil, err
	}
	if user == nil {
		fmt.Printf("[WeChat Sync] User not found\n")
		return nil, nil
	}

	if s.Wechat == nil {
		fmt.Printf("[WeChat Sync] WeChat client is nil, skipping sync\n")
		return user, nil
	}

	fmt.Printf("[WeChat Sync] Calling WeChat GetUser API...\n")
	info, err := s.Wechat.GetUser(username)
	if err != nil {
		fmt.Printf("[WeChat Sync] Error calling WeChat API: %v\n", err)
		return nil, fmt.Errorf("get wechat user info: %w", err)
	}

	// Log the info retrieved from WeChat for debugging
	fmt.Printf("[WeChat Sync] UserID: %s, Name: %s, Mobile: %s, Avatar: %s\n",
		info.UserID, info.Name, info.Mobile, info.AvatarURL)

	updates := map[string]any{
		"name":   info.Name,
		"mobile": info.Mobile,
		"avatar": info.AvatarURL,
	}
	if err := s.DB.Model(user).Updates(updates).Error; err != nil {
		fmt.Printf("[WeChat Sync] Error updating database: %v\n", err)
		return nil, fmt.Errorf("update user from wechat: %w", err)
	}

	fmt.Printf("[WeChat Sync] Successfully updated user\n")
	return s.GetUserByUsername(username)
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
