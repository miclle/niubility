package service

import (
	"fmt"

	"gorm.io/gorm/clause"

	"github.com/miclle/niubility/internal/entity"
)

// SyncDepartmentsFromWechat syncs all departments from WeChat Work.
func (s *Service) SyncDepartmentsFromWechat() (int, error) {
	if s.Wechat == nil {
		return 0, fmt.Errorf("wechat client not configured")
	}

	// Get all departments from WeChat
	deptList, err := s.Wechat.ListAllDepts()
	if err != nil {
		return 0, fmt.Errorf("list departments from wechat: %w", err)
	}

	fmt.Printf("[WeChat Sync] Found %d departments\n", len(deptList))

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
		if err := s.DB.Clauses(conds).Create(d).Error; err != nil {
			fmt.Printf("[WeChat Sync] Error upserting department %d: %v\n", dept.ID, err)
			continue
		}
	}

	return len(deptList), nil
}

// GetDepartmentByID retrieves a department by ID.
func (s *Service) GetDepartmentByID(id int64) (*entity.Department, error) {
	var dept entity.Department
	if err := s.DB.Where("id = ?", id).First(&dept).Error; err != nil {
		return nil, err
	}
	return &dept, nil
}

// ListDepartments retrieves all departments.
func (s *Service) ListDepartments() ([]entity.Department, error) {
	var departments []entity.Department
	if err := s.DB.Order("parent_id, \"order\"").Find(&departments).Error; err != nil {
		return nil, err
	}
	return departments, nil
}

// GetDepartmentUserCounts returns a map of department ID to user count.
func (s *Service) GetDepartmentUserCounts() (map[int64]int, error) {
	// Query all users and count by department_ids
	type UserCount struct {
		DepartmentIDs string
		Count         int
	}

	var users []struct {
		DepartmentIDs string
	}

	if err := s.DB.Model(&entity.User{}).Select("department_ids").Find(&users).Error; err != nil {
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
func (s *Service) GetDepartmentNamesMap() (map[int64]string, error) {
	departments, err := s.ListDepartments()
	if err != nil {
		return nil, err
	}

	result := make(map[int64]string)
	for _, dept := range departments {
		result[dept.ID] = dept.Name
	}
	return result, nil
}
