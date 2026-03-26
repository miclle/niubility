package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/miclle/niubility/internal/entity"
)

// GetUserByUsername retrieves a user by username.
func (s *Service) GetUserByUsername(ctx context.Context, username string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	var user entity.User
	if err := s.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("get user by username: %v", err)
		return nil, fmt.Errorf("get user by username: %w", err)
	}
	return &user, nil
}

// GetUserByID retrieves a user by ID.
func (s *Service) GetUserByID(ctx context.Context, id string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	var user entity.User
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		log.Errorf("get user by id: %v", err)
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &user, nil
}

// ListUsers retrieves a paginated list of users with optional search using cursor-based pagination.
func (s *Service) ListUsers(ctx context.Context, args entity.ListUsersArgs) ([]entity.User, int64, string, error) {
	log := logger.NewWithContext(ctx)

	var users []entity.User
	var total int64

	query := s.db.WithContext(ctx).Model(&entity.User{})

	// Apply search filter
	if args.Search != "" {
		searchPattern := "%" + args.Search + "%"
		query = s.whereLike(query, []string{"name", "username", "email", "mobile"}, searchPattern)
	}

	// Apply department filter
	if args.DepartmentID > 0 {
		// Match department ID in comma-separated string (at start, middle, or end)
		deptPattern := fmt.Sprintf("%%,%d,%%|^%d,%%|%%,%d$|^%d$", args.DepartmentID, args.DepartmentID, args.DepartmentID, args.DepartmentID)
		query = s.whereRegexp(query, "department_ids", deptPattern)
	}

	if err := query.Count(&total).Error; err != nil {
		log.Errorf("count users: %v", err)
		return nil, 0, "", fmt.Errorf("count users: %w", err)
	}

	if args.Cursor != "" {
		parts, err := entity.DecodeCursor(args.Cursor, 2)
		if err != nil {
			log.Errorf("decode cursor: %v", err)
			return nil, 0, "", fmt.Errorf("decode cursor: %w", err)
		}
		cursorTime, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			log.Errorf("parse cursor created_at: %v", err)
			return nil, 0, "", fmt.Errorf("parse cursor created_at: %w", err)
		}
		cursorID := parts[1]
		query = query.Where("(created_at, id) < (?, ?)", cursorTime, cursorID)
	}

	if err := query.Limit(args.GetLimit()).Order("created_at DESC, id DESC").Find(&users).Error; err != nil {
		log.Errorf("list users: %v", err)
		return nil, 0, "", fmt.Errorf("list users: %w", err)
	}

	// Build next_cursor from the last item
	var nextCursor string
	if len(users) == args.GetLimit() {
		last := users[len(users)-1]
		nextCursor = entity.EncodeCursor(last.CreatedAt.Format(time.RFC3339Nano), last.ID)
	}

	return users, total, nextCursor, nil
}

// UpsertUser creates a new user or updates the existing one by username.
// The first user is automatically set as admin. New users default to activated status.
// It also syncs user info from WeChat if available.
func (s *Service) UpsertUser(ctx context.Context, username, email string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	name, _, ok := strings.Cut(email, "@")
	if !ok {
		name = username
	}

	// first user becomes admin
	role := entity.RoleUser
	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.User{}).Count(&count).Error; err != nil {
		log.Errorf("count users: %v", err)
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
	if err := s.db.WithContext(ctx).Clauses(conds).Create(user).Error; err != nil {
		log.Errorf("upsert user: %v", err)
		return nil, fmt.Errorf("upsert user: %w", err)
	}

	// reload to get the actual record (in case it was an existing user)
	return s.GetUserByUsername(ctx, username)
}

// CreateUser creates a new user record.
func (s *Service) CreateUser(ctx context.Context, user *entity.User) error {
	log := logger.NewWithContext(ctx)

	user.ID = entity.ID()
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		log.Errorf("create user: %v", err)
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// UpdateUser updates user fields by ID.
func (s *Service) UpdateUser(ctx context.Context, id string, args entity.UpdateUserArgs) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	user, err := s.GetUserByID(ctx, id)
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
		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
			log.Errorf("update user: %v", err)
			return nil, fmt.Errorf("update user: %w", err)
		}
	}

	return user, nil
}
