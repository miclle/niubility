package entity

import "time"

// Role represents a user's role in the system.
type Role string

const (
	// RoleSuperAdmin indicates a super administrator user.
	RoleSuperAdmin Role = "super_admin"
	// RoleAdmin indicates an administrator user.
	RoleAdmin Role = "admin"
	// RoleUser indicates a regular user.
	RoleUser Role = "user"
)

// UserStatus represents the status of a user account.
type UserStatus string

const (
	// UserStatusActivated indicates an active user account.
	UserStatusActivated UserStatus = "activated"
	// UserStatusDeactivated indicates a deactivated user account.
	UserStatusDeactivated UserStatus = "deactivated"
)

// User represents a user in the system.
type User struct {
	ID            string     `json:"id"             gorm:"column:id;primaryKey;size:36"`
	Username      string     `json:"username"       gorm:"column:username;uniqueIndex:uniq_users_username"`
	Name          string     `json:"name"           gorm:"column:name"`
	Email         string     `json:"email"          gorm:"column:email"`
	Password      string     `json:"-"              gorm:"column:password"`
	Mobile        string     `json:"mobile"         gorm:"column:mobile"`
	Avatar        string     `json:"avatar"         gorm:"column:avatar"`
	DepartmentIDs string     `json:"department_ids" gorm:"column:department_ids;type:text"` // comma-separated department IDs from WeChat
	Role          Role       `json:"role"           gorm:"column:role;default:user"`
	Status        UserStatus `json:"status"         gorm:"column:status;default:activated"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// TableName specifies the database table name for User.
func (User) TableName() string {
	return "users"
}

// IsAdmin checks if the user has admin or super_admin role.
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin || u.Role == RoleSuperAdmin
}

// IsSuperAdmin checks if the user has super_admin role.
func (u *User) IsSuperAdmin() bool {
	return u.Role == RoleSuperAdmin
}

// ListUsersArgs represents the query parameters for listing users.
type ListUsersArgs struct {
	Pagination
	Search       string `form:"search"`        // search by name, username, email, or mobile
	DepartmentID int64  `form:"department_id"` // filter by department ID
}

// UpdateUserArgs represents the fields that can be updated for a user.
type UpdateUserArgs struct {
	Role   *Role       `json:"role"`
	Status *UserStatus `json:"status"`
}
