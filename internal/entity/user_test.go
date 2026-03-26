package entity

import (
	"testing"
)

func TestUser_TableName(t *testing.T) {
	u := User{}
	if got := u.TableName(); got != "users" {
		t.Errorf("TableName() = %q, want %q", got, "users")
	}
}

func TestUser_IsAdmin(t *testing.T) {
	tests := []struct {
		name string
		role Role
		want bool
	}{
		{"super_admin is admin", RoleSuperAdmin, true},
		{"admin is admin", RoleAdmin, true},
		{"user is not admin", RoleUser, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{Role: tt.role}
			if got := u.IsAdmin(); got != tt.want {
				t.Errorf("IsAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUser_IsSuperAdmin(t *testing.T) {
	tests := []struct {
		name string
		role Role
		want bool
	}{
		{"super_admin is super admin", RoleSuperAdmin, true},
		{"admin is not super admin", RoleAdmin, false},
		{"user is not super admin", RoleUser, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u := &User{Role: tt.role}
			if got := u.IsSuperAdmin(); got != tt.want {
				t.Errorf("IsSuperAdmin() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUser_ResolveAssetURLs(t *testing.T) {
	tests := []struct {
		name     string
		user     *User
		wantAvatar string
	}{
		{
			name:     "nil user",
			user:     nil,
			wantAvatar: "",
		},
		{
			name:     "empty avatar",
			user:     &User{Avatar: ""},
			wantAvatar: "",
		},
		{
			name:     "full URL unchanged",
			user:     &User{Avatar: "https://example.com/avatar.png"},
			wantAvatar: "https://example.com/avatar.png",
		},
		{
			name:     "absolute path unchanged",
			user:     &User{Avatar: "/static/avatar.png"},
			wantAvatar: "/static/avatar.png",
		},
		{
			name:     "S3 key converted",
			user:     &User{Avatar: "users/123/avatar.png"},
			wantAvatar: "/avatars/users/123/avatar.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.user.ResolveAssetURLs()
			if tt.user != nil && tt.user.Avatar != tt.wantAvatar {
				t.Errorf("Avatar = %q, want %q", tt.user.Avatar, tt.wantAvatar)
			}
		})
	}
}

func TestRole_Constants(t *testing.T) {
	if RoleSuperAdmin != "super_admin" {
		t.Errorf("RoleSuperAdmin = %q, want %q", RoleSuperAdmin, "super_admin")
	}
	if RoleAdmin != "admin" {
		t.Errorf("RoleAdmin = %q, want %q", RoleAdmin, "admin")
	}
	if RoleUser != "user" {
		t.Errorf("RoleUser = %q, want %q", RoleUser, "user")
	}
}

func TestUserStatus_Constants(t *testing.T) {
	if UserStatusActivated != "activated" {
		t.Errorf("UserStatusActivated = %q, want %q", UserStatusActivated, "activated")
	}
	if UserStatusDeactivated != "deactivated" {
		t.Errorf("UserStatusDeactivated = %q, want %q", UserStatusDeactivated, "deactivated")
	}
}
