package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/bcrypt"
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

// ListUsers retrieves a paginated list of users with optional search.
func (s *Service) ListUsers(args entity.ListUsersArgs) ([]entity.User, int64, error) {
	var users []entity.User
	var total int64

	query := s.DB.Model(&entity.User{})

	// Apply search filter
	if args.Search != "" {
		searchPattern := "%" + args.Search + "%"
		query = query.Where(
			"name ILIKE ? OR username ILIKE ? OR email ILIKE ? OR mobile ILIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern,
		)
	}

	// Apply department filter
	if args.DepartmentID > 0 {
		// Match department ID in comma-separated string (at start, middle, or end)
		deptPattern := fmt.Sprintf("%%,%d,%%|^%d,%%|%%,%d$|^%d$", args.DepartmentID, args.DepartmentID, args.DepartmentID, args.DepartmentID)
		query = query.Where("department_ids ~ ?", deptPattern)
	}

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
	if err := s.DB.Model(user).Updates(updates).Error; err != nil {
		fmt.Printf("[WeChat Sync] Error updating database: %v\n", err)
		return nil, fmt.Errorf("update user from wechat: %w", err)
	}

	fmt.Printf("[WeChat Sync] Successfully updated user\n")
	return s.GetUserByUsername(username)
}

// SyncAllUsersFromWechat syncs all users' info from WeChat.
// Returns the count of successfully synced users and any errors encountered.
func (s *Service) SyncAllUsersFromWechat() (synced int, failed int, err error) {
	if s.Wechat == nil {
		return 0, 0, fmt.Errorf("wechat client not configured")
	}

	var users []entity.User
	if err := s.DB.Find(&users).Error; err != nil {
		return 0, 0, fmt.Errorf("list users: %w", err)
	}

	for _, user := range users {
		_, err := s.SyncUserFromWechat(user.Username)
		if err != nil {
			fmt.Printf("[WeChat Sync] Failed to sync user %s: %v\n", user.Username, err)
			failed++
		} else {
			synced++
		}
	}

	return synced, failed, nil
}

// SyncAllWechatUsers fetches all users from WeChat Work and syncs them to database.
// This will create new users and update existing ones.
func (s *Service) SyncAllWechatUsers() (synced int, failed int, err error) {
	if s.Wechat == nil {
		return 0, 0, fmt.Errorf("wechat client not configured")
	}

	// Get all departments first
	deptList, err := s.Wechat.ListAllDepts()
	if err != nil {
		return 0, 0, fmt.Errorf("list departments: %w", err)
	}

	fmt.Printf("[WeChat Sync] Found %d departments, fetching users...\n", len(deptList))

	// Track synced user IDs to avoid duplicates
	seenUsers := make(map[string]bool)

	// Fetch users from each department
	for _, dept := range deptList {
		users, err := s.Wechat.ListUsersByDeptID(dept.ID, true)
		if err != nil {
			fmt.Printf("[WeChat Sync] Failed to list users in dept %d: %v\n", dept.ID, err)
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
			existingUser, _ := s.GetUserByUsername(info.UserID)
			if existingUser != nil {
				user.Role = existingUser.Role
				user.ID = existingUser.ID
			} else {
				// First user becomes admin
				var count int64
				s.DB.Model(&entity.User{}).Count(&count)
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
			if err := s.DB.Clauses(conds).Create(user).Error; err != nil {
				fmt.Printf("[WeChat Sync] Failed to upsert user %s: %v\n", info.UserID, err)
				failed++
			} else {
				synced++
			}
		}
	}

	fmt.Printf("[WeChat Sync] Synced %d users, %d failed\n", synced, failed)
	return synced, failed, nil
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

// InitSuperAdmin creates the initial super admin user and marks the system as initialized.
func (s *Service) InitSuperAdmin(username, email, password string) (*entity.User, error) {
	if s.IsInitialized() {
		return nil, fmt.Errorf("system is already initialized")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
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

	if err := s.DB.Create(user).Error; err != nil {
		return nil, fmt.Errorf("create super admin: %w", err)
	}

	// Mark system as initialized
	if err := s.SetSetting(entity.SettingInitialized, "true"); err != nil {
		return nil, fmt.Errorf("set initialized flag: %w", err)
	}

	return user, nil
}

// RegisterUser creates a new user account with password. New users default to deactivated status.
func (s *Service) RegisterUser(username, email, password string) (*entity.User, error) {
	// Check if username already exists
	existing, err := s.GetUserByUsername(username)
	if err != nil {
		return nil, fmt.Errorf("check existing user: %w", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("username already exists")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
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

	if err := s.DB.Create(user).Error; err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	return user, nil
}

// AuthenticateUser verifies a username and password, returning the user if valid.
func (s *Service) AuthenticateUser(username, password string) (*entity.User, error) {
	var user entity.User
	if err := s.DB.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("invalid username or password")
		}
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

// GetUserContentCount returns the number of contents authored by the given user.
func (s *Service) GetUserContentCount(userID string) (int64, error) {
	var count int64
	if err := s.DB.Model(&entity.Content{}).Where("author_id = ?", userID).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count user contents: %w", err)
	}
	return count, nil
}

// GetUserTotalLikes returns the total like count across all contents authored by the given user.
func (s *Service) GetUserTotalLikes(userID string) (int64, error) {
	var total int64
	if err := s.DB.Model(&entity.Content{}).Where("author_id = ?", userID).Select("COALESCE(SUM(like_count), 0)").Row().Scan(&total); err != nil {
		return 0, fmt.Errorf("sum user likes: %w", err)
	}
	return total, nil
}

// GetUserSpeakerContentCount returns the number of contents where the given user is the speaker.
func (s *Service) GetUserSpeakerContentCount(userID string) (int64, error) {
	var count int64
	if err := s.DB.Model(&entity.Content{}).Where("speaker_id = ?", userID).Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count speaker contents: %w", err)
	}
	return count, nil
}
