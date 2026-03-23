package service

import (
	"context"
	"fmt"

	"github.com/fox-gonic/fox/logger"
	"gorm.io/gorm/clause"

	"github.com/miclle/niubility/internal/entity"
)

// SyncDepartmentsFromWechat syncs all departments from WeChat Work.
func (s *Service) SyncDepartmentsFromWechat(ctx context.Context) (int, error) {
	log := logger.NewWithContext(ctx)

	if s.Wechat == nil {
		return 0, fmt.Errorf("wechat client not configured")
	}

	// Get all departments from WeChat
	deptList, err := s.Wechat.ListAllDepts()
	if err != nil {
		log.Errorf("SyncDepartmentsFromWechat: list departments: %v", err)
		return 0, fmt.Errorf("list departments from wechat: %w", err)
	}

	log.Infof("[WeChat Sync] Found %d departments", len(deptList))

	// Upsert each department
	for _, dept := range deptList {
		d := &entity.Department{
			ID:       dept.ID,
			Name:     dept.Name,
			NameEn:   dept.NameEn,
			ParentID: dept.ParentID,
			Order:    dept.Order,
		}

		conds := clause.OnConflict{
			Columns:   []clause.Column{{Name: "id"}},
			DoUpdates: clause.AssignmentColumns([]string{"name", "name_en", "parent_id", "order"}),
		}
		if err := s.db.WithContext(ctx).Clauses(conds).Create(d).Error; err != nil {
			log.Errorf("[WeChat Sync] Error upserting department %d: %v", dept.ID, err)
			continue
		}
	}

	return len(deptList), nil
}

// GetDepartmentByID retrieves a department by ID.
func (s *Service) GetDepartmentByID(ctx context.Context, id int64) (*entity.Department, error) {
	log := logger.NewWithContext(ctx)

	var dept entity.Department
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&dept).Error; err != nil {
		log.Errorf("GetDepartmentByID: %v", err)
		return nil, err
	}
	return &dept, nil
}

// ListDepartments retrieves all departments.
func (s *Service) ListDepartments(ctx context.Context) ([]entity.Department, error) {
	log := logger.NewWithContext(ctx)

	var departments []entity.Department
	if err := s.db.WithContext(ctx).Order("parent_id, \"order\"").Find(&departments).Error; err != nil {
		log.Errorf("ListDepartments: %v", err)
		return nil, err
	}
	return departments, nil
}

// GetDepartmentUserCounts returns a map of department ID to user count.
func (s *Service) GetDepartmentUserCounts(ctx context.Context) (map[int64]int, error) {
	log := logger.NewWithContext(ctx)

	// Query all users and count by department_ids
	var users []struct {
		DepartmentIDs string
	}

	if err := s.db.WithContext(ctx).Model(&entity.User{}).Select("department_ids").Find(&users).Error; err != nil {
		log.Errorf("GetDepartmentUserCounts: %v", err)
		return nil, err
	}

	// Count users per department
	counts := make(map[int64]int)
	for _, user := range users {
		if user.DepartmentIDs == "" {
			continue
		}
		// Parse comma-separated department IDs
		for _, idStr := range splitIDs(user.DepartmentIDs) {
			if idStr == "" {
				continue
			}
			var id int64
			if _, err := fmt.Sscanf(idStr, "%d", &id); err == nil && id > 0 {
				counts[id]++
			}
		}
	}

	return counts, nil
}

// splitIDs splits a comma-separated string of IDs.
func splitIDs(s string) []string {
	result := []string{}
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if i > start {
				result = append(result, s[start:i])
			}
			start = i + 1
		}
	}
	return result
}

// GetDepartmentNamesMap returns a map of department ID to name.
func (s *Service) GetDepartmentNamesMap(ctx context.Context) (map[int64]string, error) {
	departments, err := s.ListDepartments(ctx)
	if err != nil {
		return nil, err
	}

	result := make(map[int64]string)
	for _, dept := range departments {
		result[dept.ID] = dept.Name
	}
	return result, nil
}
