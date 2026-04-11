package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/fox-gonic/fox/logger"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/miclle/niubility/internal/entity"
)

var (
	ErrUserUsernameExists   = errors.New("username already exists")
	ErrUserInvalidUsername  = errors.New("username is required")
	ErrUserInvalidEmail     = errors.New("email is required")
	ErrUserPasswordTooShort = errors.New("password length must be at least 6 characters")
	ErrUserInvalidRole      = errors.New("invalid user role")
	ErrUserInvalidStatus    = errors.New("invalid user status")
	ErrUserLastActiveAdmin  = errors.New("at least one active admin must remain")
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

// CreateManagedUser creates a new user for admin-side CRUD.
func (s *Service) CreateManagedUser(ctx context.Context, args entity.CreateUserArgs) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	username := strings.TrimSpace(args.Username)
	email := strings.TrimSpace(args.Email)
	if username == "" {
		return nil, ErrUserInvalidUsername
	}
	if email == "" {
		return nil, ErrUserInvalidEmail
	}

	if err := validateUserRole(args.Role); err != nil {
		return nil, err
	}
	if err := validateUserStatus(args.Status); err != nil {
		return nil, err
	}

	existing, err := s.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, ErrUserUsernameExists
	}

	user := &entity.User{
		ID:       entity.ID(),
		Username: username,
		Name:     defaultUserName(username, email),
		Email:    email,
		Role:     entity.RoleUser,
		Status:   entity.UserStatusActivated,
	}

	if args.Name != nil {
		user.Name = strings.TrimSpace(*args.Name)
	}
	if args.Mobile != nil {
		user.Mobile = *args.Mobile
	}
	if args.Avatar != nil {
		user.Avatar = *args.Avatar
	}
	if args.Bio != nil {
		user.Bio = *args.Bio
	}
	if args.Location != nil {
		user.Location = *args.Location
	}
	if args.DepartmentIDs != nil {
		user.DepartmentIDs = *args.DepartmentIDs
	}
	if args.SocialAccounts != nil {
		user.SocialAccounts = args.SocialAccounts
	}
	if args.Role != nil {
		user.Role = *args.Role
	}
	if args.Status != nil {
		user.Status = *args.Status
	}
	if args.CreatedAt != nil {
		user.CreatedAt = *args.CreatedAt
	}
	if args.UpdatedAt != nil {
		user.UpdatedAt = *args.UpdatedAt
	}

	hashedPassword, err := hashOptionalPassword(args.Password)
	if err != nil {
		return nil, err
	}
	user.Password = hashedPassword

	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		log.Errorf("create managed user: %v", err)
		return nil, fmt.Errorf("create managed user: %w", err)
	}

	return s.GetUserByID(ctx, user.ID)
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

	if err := validateUserRole(args.Role); err != nil {
		return nil, err
	}
	if err := validateUserStatus(args.Status); err != nil {
		return nil, err
	}

	if args.Username != nil {
		username := strings.TrimSpace(*args.Username)
		if username == "" {
			return nil, ErrUserInvalidUsername
		}
		existing, err := s.GetUserByUsername(ctx, username)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.ID != user.ID {
			return nil, ErrUserUsernameExists
		}
	}

	nextRole := user.Role
	if args.Role != nil {
		nextRole = *args.Role
	}
	nextStatus := user.Status
	if args.Status != nil {
		nextStatus = *args.Status
	}
	if user.IsAdmin() && (nextRole != user.Role || nextStatus != user.Status) && !roleCanAccessAdmin(nextRole, nextStatus) {
		ok, err := s.hasAnotherActiveAdmin(ctx, user.ID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrUserLastActiveAdmin
		}
	}

	updates, err := buildUserUpdates(args)
	if err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return applyUserUpdates(log, tx, user, args, updates)
	}); err != nil {
		return nil, err
	}

	return s.GetUserByID(ctx, id)
}

// buildUserUpdates constructs the column updates map from non-nil args.
func buildUserUpdates(args entity.UpdateUserArgs) (map[string]any, error) {
	updates := map[string]any{}
	if args.Username != nil {
		updates["username"] = strings.TrimSpace(*args.Username)
	}
	if args.Email != nil {
		email := strings.TrimSpace(*args.Email)
		if email == "" {
			return nil, ErrUserInvalidEmail
		}
		updates["email"] = email
	}
	if args.Name != nil {
		updates["name"] = strings.TrimSpace(*args.Name)
	}
	if args.Mobile != nil {
		updates["mobile"] = *args.Mobile
	}
	if args.Avatar != nil {
		updates["avatar"] = *args.Avatar
	}
	if args.Bio != nil {
		updates["bio"] = *args.Bio
	}
	if args.Location != nil {
		updates["location"] = *args.Location
	}
	if args.DepartmentIDs != nil {
		updates["department_ids"] = *args.DepartmentIDs
	}
	if args.Role != nil {
		updates["role"] = *args.Role
	}
	if args.Status != nil {
		updates["status"] = *args.Status
	}
	if args.CreatedAt != nil {
		updates["created_at"] = *args.CreatedAt
	}
	if args.UpdatedAt != nil {
		updates["updated_at"] = *args.UpdatedAt
	}
	return updates, nil
}

// applyUserUpdates applies all user changes within a transaction.
func applyUserUpdates(log logger.Logger, tx *gorm.DB, user *entity.User, args entity.UpdateUserArgs, updates map[string]any) error {
	if len(updates) > 0 {
		if err := tx.Model(user).Updates(updates).Error; err != nil {
			log.Errorf("update user: %v", err)
			return fmt.Errorf("update user: %w", err)
		}
	}

	if args.SocialAccounts != nil {
		user.SocialAccounts = args.SocialAccounts
		if err := tx.Model(user).Select("social_accounts").Updates(user).Error; err != nil {
			log.Errorf("update user social_accounts: %v", err)
			return fmt.Errorf("update user social_accounts: %w", err)
		}
	}

	if args.Password != nil {
		hashed, err := hashOptionalPassword(args.Password)
		if err != nil {
			return err
		}
		if err := tx.Model(user).Update("password", hashed).Error; err != nil {
			log.Errorf("update user password: %v", err)
			return fmt.Errorf("update user password: %w", err)
		}
	}

	if args.CreatedAt != nil {
		if err := tx.Model(user).UpdateColumn("created_at", *args.CreatedAt).Error; err != nil {
			log.Errorf("update user created_at: %v", err)
			return fmt.Errorf("update user created_at: %w", err)
		}
	}

	if args.UpdatedAt != nil {
		if err := tx.Model(user).UpdateColumn("updated_at", *args.UpdatedAt).Error; err != nil {
			log.Errorf("update user updated_at: %v", err)
			return fmt.Errorf("update user updated_at: %w", err)
		}
	}

	return nil
}

// DeleteUser deletes a user by ID.
func (s *Service) DeleteUser(ctx context.Context, id string) error {
	log := logger.NewWithContext(ctx)

	user, err := s.GetUserByID(ctx, id)
	if err != nil {
		return err
	}
	if user == nil {
		return nil
	}

	if roleCanAccessAdmin(user.Role, user.Status) {
		ok, err := s.hasAnotherActiveAdmin(ctx, user.ID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrUserLastActiveAdmin
		}
	}

	if err := s.db.WithContext(ctx).Where("id = ?", id).Delete(&entity.User{}).Error; err != nil {
		log.Errorf("delete user: %v", err)
		return fmt.Errorf("delete user: %w", err)
	}
	return nil
}

func hashOptionalPassword(password *string) (string, error) {
	if password == nil || *password == "" {
		return "", nil
	}
	if len(*password) < 6 {
		return "", ErrUserPasswordTooShort
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(*password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hashed), nil
}

func defaultUserName(username, email string) string {
	name, _, ok := strings.Cut(email, "@")
	if !ok || name == "" {
		return username
	}
	return name
}

func validateUserRole(role *entity.Role) error {
	if role == nil {
		return nil
	}
	switch *role {
	case entity.RoleSuperAdmin, entity.RoleAdmin, entity.RoleUser:
		return nil
	default:
		return ErrUserInvalidRole
	}
}

func validateUserStatus(status *entity.UserStatus) error {
	if status == nil {
		return nil
	}
	switch *status {
	case entity.UserStatusActivated, entity.UserStatusDeactivated:
		return nil
	default:
		return ErrUserInvalidStatus
	}
}

func roleCanAccessAdmin(role entity.Role, status entity.UserStatus) bool {
	return (role == entity.RoleAdmin || role == entity.RoleSuperAdmin) && status == entity.UserStatusActivated
}

func (s *Service) hasAnotherActiveAdmin(ctx context.Context, excludeID string) (bool, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	if err := s.db.WithContext(ctx).
		Model(&entity.User{}).
		Where("id <> ? AND status = ? AND role IN ?", excludeID, entity.UserStatusActivated, []entity.Role{entity.RoleAdmin, entity.RoleSuperAdmin}).
		Count(&count).Error; err != nil {
		log.Errorf("count active admins: %v", err)
		return false, fmt.Errorf("count active admins: %w", err)
	}
	return count > 0, nil
}
