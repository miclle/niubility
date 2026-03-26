package service

import (
	"context"
	"testing"

	"github.com/miclle/niubility/internal/entity"
)

// Note: ToggleFollow tests are skipped for SQLite because SQLite doesn't support GREATEST function.
// The ToggleFollow functionality should be tested with PostgreSQL or MySQL in integration tests.

func TestService_IsFollowing(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create users
	user1 := &entity.User{ID: entity.ID(), Username: "isfollowing1", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	user2 := &entity.User{ID: entity.ID(), Username: "isfollowing2", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user1).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(user2).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Should not be following initially
	following, err := s.IsFollowing(ctx, user1.ID, user2.ID)
	if err != nil {
		t.Fatalf("IsFollowing() error = %v", err)
	}
	if following {
		t.Error("IsFollowing() = true, want false")
	}

	// Create follow directly (bypass ToggleFollow which uses GREATEST)
	rel := &entity.Follow{
		ID:          entity.ID(),
		FollowerID:  user1.ID,
		FollowingID: user2.ID,
	}
	if err := s.db.Create(rel).Error; err != nil {
		t.Fatalf("Failed to create follow: %v", err)
	}

	// Should be following now
	following, err = s.IsFollowing(ctx, user1.ID, user2.ID)
	if err != nil {
		t.Fatalf("IsFollowing() error = %v", err)
	}
	if !following {
		t.Error("IsFollowing() = false, want true")
	}
}

func TestService_ListFollowing(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create users
	user := &entity.User{ID: entity.ID(), Username: "listfollowing", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	following1 := &entity.User{ID: entity.ID(), Username: "following1", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	following2 := &entity.User{ID: entity.ID(), Username: "following2", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(following1).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(following2).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create follows directly (bypass ToggleFollow which uses GREATEST)
	rel1 := &entity.Follow{ID: entity.ID(), FollowerID: user.ID, FollowingID: following1.ID}
	rel2 := &entity.Follow{ID: entity.ID(), FollowerID: user.ID, FollowingID: following2.ID}
	if err := s.db.Create(rel1).Error; err != nil {
		t.Fatalf("Failed to create follow: %v", err)
	}
	if err := s.db.Create(rel2).Error; err != nil {
		t.Fatalf("Failed to create follow: %v", err)
	}

	// List following
	users, _, err := s.ListFollowing(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListFollowing() error = %v", err)
	}
	if len(users) != 2 {
		t.Errorf("len(users) = %d, want 2", len(users))
	}
}

func TestService_ListFollowers(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	// Create users
	user := &entity.User{ID: entity.ID(), Username: "listfollowers", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	follower1 := &entity.User{ID: entity.ID(), Username: "lfollower1", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	follower2 := &entity.User{ID: entity.ID(), Username: "lfollower2", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(follower1).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}
	if err := s.db.Create(follower2).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Create follows directly (bypass ToggleFollow which uses GREATEST)
	rel1 := &entity.Follow{ID: entity.ID(), FollowerID: follower1.ID, FollowingID: user.ID}
	rel2 := &entity.Follow{ID: entity.ID(), FollowerID: follower2.ID, FollowingID: user.ID}
	if err := s.db.Create(rel1).Error; err != nil {
		t.Fatalf("Failed to create follow: %v", err)
	}
	if err := s.db.Create(rel2).Error; err != nil {
		t.Fatalf("Failed to create follow: %v", err)
	}

	// List followers
	users, _, err := s.ListFollowers(ctx, user.ID, entity.Pagination{Limit: 10})
	if err != nil {
		t.Fatalf("ListFollowers() error = %v", err)
	}
	if len(users) != 2 {
		t.Errorf("len(users) = %d, want 2", len(users))
	}
}

func TestService_ToggleFollow_SelfFollow(t *testing.T) {
	s := setupTestService(t)
	ctx := context.Background()

	user := &entity.User{ID: entity.ID(), Username: "selffollow", Role: entity.RoleUser, Status: entity.UserStatusActivated}
	if err := s.db.Create(user).Error; err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Cannot follow yourself
	_, err := s.ToggleFollow(ctx, user.ID, user.ID)
	if err == nil {
		t.Error("ToggleFollow() should fail when following yourself")
	}
}
