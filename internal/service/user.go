package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/fox-gonic/fox/logger"
	"golang.org/x/crypto/bcrypt"
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

// SyncUserFromWechat syncs user info from WeChat by username.
func (s *Service) SyncUserFromWechat(ctx context.Context, username string) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	log.Infof("[WeChat Sync] Starting sync for username: %s", username)

	user, err := s.GetUserByUsername(ctx, username)
	if err != nil {
		log.Errorf("[WeChat Sync] Error getting user: %v", err)
		return nil, err
	}
	if user == nil {
		log.Infof("[WeChat Sync] User not found")
		return nil, nil
	}

	if s.Wechat == nil {
		log.Infof("[WeChat Sync] WeChat client is nil, skipping sync")
		return user, nil
	}

	log.Infof("[WeChat Sync] Calling WeChat GetUser API...")
	info, err := s.Wechat.GetUser(username)
	if err != nil {
		log.Errorf("[WeChat Sync] Error calling WeChat API: %v", err)
		return nil, fmt.Errorf("get wechat user info: %w", err)
	}

	// Log the info retrieved from WeChat for debugging
	log.Infof("[WeChat Sync] UserID: %s, Name: %s, Mobile: %s, Avatar: %s",
		info.UserID, info.Name, info.Mobile, info.AvatarURL)

	// Convert department IDs to comma-separated string
	var deptIDs []string
	for _, dept := range info.Departments {
		deptIDs = append(deptIDs, strconv.FormatInt(dept.DeptID, 10))
	}
	departmentIDs := strings.Join(deptIDs, ",")

	updates := map[string]any{
		"name":           info.Name,
		"mobile":         info.Mobile,
		"avatar":         info.AvatarURL,
		"department_ids": departmentIDs,
	}
	if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
		log.Errorf("[WeChat Sync] Error updating database: %v", err)
		return nil, fmt.Errorf("update user from wechat: %w", err)
	}

	log.Infof("[WeChat Sync] Successfully updated user")
	return s.GetUserByUsername(ctx, username)
}

// SyncAllUsersFromWechat syncs all users' info from WeChat.
// Returns the count of successfully synced users and any errors encountered.
func (s *Service) SyncAllUsersFromWechat(ctx context.Context) (synced int, failed int, err error) {
	log := logger.NewWithContext(ctx)

	if s.Wechat == nil {
		log.Errorf("wechat client not configured")
		return 0, 0, fmt.Errorf("wechat client not configured")
	}

	var users []entity.User
	if err := s.db.WithContext(ctx).Find(&users).Error; err != nil {
		log.Errorf("list users: %v", err)
		return 0, 0, fmt.Errorf("list users: %w", err)
	}

	for _, user := range users {
		_, err := s.SyncUserFromWechat(ctx, user.Username)
		if err != nil {
			log.Errorf("[WeChat Sync] Failed to sync user %s: %v", user.Username, err)
			failed++
		} else {
			synced++
		}
	}

	return synced, failed, nil
}

// SyncAllWechatUsers fetches all users from WeChat Work and syncs them to database.
// This will create new users and update existing ones.
func (s *Service) SyncAllWechatUsers(ctx context.Context) (synced int, failed int, err error) {
	log := logger.NewWithContext(ctx)

	if s.Wechat == nil {
		log.Errorf("wechat client not configured")
		return 0, 0, fmt.Errorf("wechat client not configured")
	}

	// Get all departments first
	deptList, err := s.Wechat.ListAllDepts()
	if err != nil {
		log.Errorf("list departments: %v", err)
		return 0, 0, fmt.Errorf("list departments: %w", err)
	}

	log.Infof("[WeChat Sync] Found %d departments, fetching users...", len(deptList))

	// Track synced user IDs to avoid duplicates
	seenUsers := make(map[string]bool)

	// Fetch users from each department
	for _, dept := range deptList {
		users, err := s.Wechat.ListUsersByDeptID(dept.ID, true)
		if err != nil {
			log.Errorf("[WeChat Sync] Failed to list users in dept %d: %v", dept.ID, err)
			continue
		}

		for _, info := range users {
			// Skip if already synced
			if seenUsers[info.UserID] {
				continue
			}
			seenUsers[info.UserID] = true

			// Convert department IDs to comma-separated string
			var deptIDs []string
			for _, dept := range info.Departments {
				deptIDs = append(deptIDs, strconv.FormatInt(dept.DeptID, 10))
			}
			departmentIDs := strings.Join(deptIDs, ",")

			// Upsert user
			user := &entity.User{
				Username:      info.UserID,
				Name:          info.Name,
				Email:         info.Email,
				Mobile:        info.Mobile,
				Avatar:        info.AvatarURL,
				DepartmentIDs: departmentIDs,
				Status:        entity.UserStatusActivated,
			}

			// Check if user exists to determine role
			existingUser, _ := s.GetUserByUsername(ctx, info.UserID)
			if existingUser != nil {
				user.Role = existingUser.Role
				user.ID = existingUser.ID
			} else {
				// First user becomes admin
				var count int64
				s.db.WithContext(ctx).Model(&entity.User{}).Count(&count)
				if count == 0 {
					user.Role = entity.RoleAdmin
				} else {
					user.Role = entity.RoleUser
				}
				user.ID = entity.ID()
			}

			conds := clause.OnConflict{
				Columns:   []clause.Column{{Name: "username"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "email", "mobile", "avatar", "department_ids"}),
			}
			if err := s.db.WithContext(ctx).Clauses(conds).Create(user).Error; err != nil {
				log.Errorf("[WeChat Sync] Failed to upsert user %s: %v", info.UserID, err)
				failed++
			} else {
				synced++
			}
		}
	}

	log.Infof("[WeChat Sync] Synced %d users, %d failed", synced, failed)
	return synced, failed, nil
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

// UpdateProfile updates a user's own profile fields by ID.
func (s *Service) UpdateProfile(ctx context.Context, id string, args entity.UpdateProfileArgs) (*entity.User, error) {
	log := logger.NewWithContext(ctx)

	user, err := s.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, nil
	}

	updates := map[string]any{}
	if args.Name != nil {
		updates["name"] = *args.Name
	}
	if args.Bio != nil {
		updates["bio"] = *args.Bio
	}
	if args.Location != nil {
		updates["location"] = *args.Location
	}
	if args.Avatar != nil {
		updates["avatar"] = *args.Avatar
	}
	// SocialAccounts uses GORM's serializer:json tag, which is not honored by map-based Updates.
	// Apply it separately via struct-based update so the serializer encodes it as JSON.
	if args.SocialAccounts != nil {
		user.SocialAccounts = args.SocialAccounts
		if err := s.db.WithContext(ctx).Model(user).Select("social_accounts").Updates(user).Error; err != nil {
			log.Errorf("update profile social_accounts: %v", err)
			return nil, fmt.Errorf("update profile social_accounts: %w", err)
		}
	}

	if len(updates) > 0 {
		if err := s.db.WithContext(ctx).Model(user).Updates(updates).Error; err != nil {
			log.Errorf("update profile: %v", err)
			return nil, fmt.Errorf("update profile: %w", err)
		}
	}

	return s.GetUserByID(ctx, id)
}

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
			return fmt.Errorf("旧密码不正确")
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

// GetUserContentCount returns the number of contents authored by the given user.
func (s *Service) GetUserContentCount(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).Where("author_id = ?", userID).Count(&count).Error; err != nil {
		log.Errorf("count user contents: %v", err)
		return 0, fmt.Errorf("count user contents: %w", err)
	}
	return count, nil
}

// GetUserTotalLikes returns the total like count across all contents authored by the given user.
func (s *Service) GetUserTotalLikes(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var total int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).Where("author_id = ?", userID).Select("COALESCE(SUM(like_count), 0)").Row().Scan(&total); err != nil {
		log.Errorf("sum user likes: %v", err)
		return 0, fmt.Errorf("sum user likes: %w", err)
	}
	return total, nil
}

// GetUserSpeakerContentCount returns the number of contents where the given user is the speaker.
func (s *Service) GetUserSpeakerContentCount(ctx context.Context, userID string) (int64, error) {
	log := logger.NewWithContext(ctx)

	var count int64
	if err := s.db.WithContext(ctx).Model(&entity.Content{}).Where("speaker_id = ?", userID).Count(&count).Error; err != nil {
		log.Errorf("count speaker contents: %v", err)
		return 0, fmt.Errorf("count speaker contents: %w", err)
	}
	return count, nil
}
