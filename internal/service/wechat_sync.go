package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm/clause"

	"github.com/miclle/niubility/internal/entity"
)

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
