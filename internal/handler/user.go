// Package handler provides HTTP handlers and route registration.
package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// SearchUsersArgs represents the query parameters for searching users.
type SearchUsersArgs struct {
	Q string `form:"q"`
}

// SearchUserItem represents a simplified user item for search results.
type SearchUserItem struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Avatar string `json:"avatar"`
}

// SearchUsersResponse represents the response for searching users.
type SearchUsersResponse struct {
	Users []SearchUserItem `json:"users"`
}

// SearchUsers returns a list of users matching the search query (authenticated users).
func (ctrl *Ctrl) SearchUsers(c *fox.Context, args *SearchUsersArgs) (*SearchUsersResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	if args.Q == "" {
		return &SearchUsersResponse{Users: []SearchUserItem{}}, nil
	}

	users, _, _, err := ctrl.service.ListUsers(ctx, entity.ListUsersArgs{
		Pagination: entity.Pagination{Limit: 20},
		Search:     args.Q,
	})
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	items := make([]SearchUserItem, len(users))
	for i, u := range users {
		items[i] = SearchUserItem{
			ID:     u.ID,
			Name:   u.Name,
			Avatar: entity.AvatarURL(u.Avatar),
		}
	}

	return &SearchUsersResponse{Users: items}, nil
}

// ListUsersResponse represents the response for listing users.
type ListUsersResponse struct {
	Items      []entity.User `json:"items"`
	NextCursor string        `json:"next_cursor,omitempty"`
	Total      *int64        `json:"total,omitempty"`
}

// ListUsers returns a paginated list of users (admin only).
func (ctrl *Ctrl) ListUsers(c *fox.Context, args entity.ListUsersArgs) (*ListUsersResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	users, total, nextCursor, err := ctrl.service.ListUsers(ctx, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range users {
		users[i].ResolveAssetURLs()
	}

	return &ListUsersResponse{
		Items:      users,
		NextCursor: nextCursor,
		Total:      &total,
	}, nil
}

// UpdateUser updates a user's role or status (admin only).
func (ctrl *Ctrl) UpdateUser(c *fox.Context, args entity.UpdateUserArgs) (*entity.User, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	id := c.Param("id")

	user, err := ctrl.service.UpdateUser(ctx, id, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if user == nil {
		return nil, httperrors.ErrNotFound
	}

	user.ResolveAssetURLs()
	return user, nil
}

// SyncUserFromWechat syncs the current user's info from WeChat.
func (ctrl *Ctrl) SyncUserFromWechat(c *fox.Context) (*entity.User, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	updatedUser, err := ctrl.service.SyncUserFromWechat(ctx, user.Username)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if updatedUser == nil {
		return nil, httperrors.ErrNotFound
	}

	updatedUser.ResolveAssetURLs()
	return updatedUser, nil
}

// SyncFromWechatResponse represents the response for syncing from WeChat.
type SyncFromWechatResponse struct {
	DepartmentsSynced int `json:"departments_synced"`
	UsersSynced       int `json:"users_synced"`
	UsersFailed       int `json:"users_failed"`
}

// SyncFromWechat syncs departments and all users from WeChat Work (admin only).
func (ctrl *Ctrl) SyncFromWechat(c *fox.Context) (*SyncFromWechatResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	// Sync departments first
	deptCount, err := ctrl.service.SyncDepartmentsFromWechat(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Sync all users from WeChat
	userSynced, userFailed, err := ctrl.service.SyncAllWechatUsers(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return &SyncFromWechatResponse{
		DepartmentsSynced: deptCount,
		UsersSynced:       userSynced,
		UsersFailed:       userFailed,
	}, nil
}

// ListDepartmentsResponse represents the response for listing departments.
type ListDepartmentsResponse struct {
	Departments []DepartmentWithCount `json:"departments"`
}

// DepartmentWithCount represents a department with user count.
type DepartmentWithCount struct {
	entity.Department
	UserCount int `json:"user_count"`
}

// ListDepartments returns all departments (admin only).
func (ctrl *Ctrl) ListDepartments(c *fox.Context) (*ListDepartmentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	departments, err := ctrl.service.ListDepartments(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Get user counts per department
	userCounts, err := ctrl.service.GetDepartmentUserCounts(ctx)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	// Build response with user counts
	result := make([]DepartmentWithCount, len(departments))
	for i, dept := range departments {
		result[i] = DepartmentWithCount{
			Department: dept,
			UserCount:  userCounts[dept.ID],
		}
	}

	return &ListDepartmentsResponse{Departments: result}, nil
}
