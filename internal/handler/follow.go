package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// resolveUserByUsername looks up a user by the :username route param and returns their ID.
func (ctrl *Ctrl) resolveUserByUsername(c *fox.Context) (string, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	username := c.Param("username")
	if username == "" {
		return "", httperrors.ErrInvalidArguments
	}

	target, err := ctrl.service.GetUserByUsername(ctx, username)
	if err != nil {
		c.Logger.Errorf("resolve user by username: %v", err)
		return "", httperrors.ErrInternalServerError
	}
	if target == nil {
		return "", httperrors.ErrNotFound
	}
	return target.ID, nil
}

// ToggleFollow toggles the follow state between the current user and the target user.
func (ctrl *Ctrl) ToggleFollow(c *fox.Context) (*entity.FollowResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	targetID, err := ctrl.resolveUserByUsername(c)
	if err != nil {
		return nil, err
	}

	resp, err := ctrl.service.ToggleFollow(ctx, user.ID, targetID)
	if err != nil {
		c.Logger.Errorf("toggle follow: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}

// listFollowUsers is a shared handler for listing following/followers.
func (ctrl *Ctrl) listFollowUsers(c *fox.Context, args entity.Pagination, fetcher func(string, entity.Pagination) ([]entity.User, string, error)) (*ListUsersResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	targetID, err := ctrl.resolveUserByUsername(c)
	if err != nil {
		return nil, err
	}

	users, nextCursor, err := fetcher(targetID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range users {
		users[i].ResolveAssetURLs()
	}

	return &ListUsersResponse{Items: users, NextCursor: nextCursor}, nil
}

// ListFollowing returns the list of users that the target user is following.
func (ctrl *Ctrl) ListFollowing(c *fox.Context, args entity.Pagination) (*ListUsersResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	return ctrl.listFollowUsers(c, args, func(userID string, p entity.Pagination) ([]entity.User, string, error) {
		return ctrl.service.ListFollowing(ctx, userID, p)
	})
}

// ListFollowers returns the list of users who follow the target user.
func (ctrl *Ctrl) ListFollowers(c *fox.Context, args entity.Pagination) (*ListUsersResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	return ctrl.listFollowUsers(c, args, func(userID string, p entity.Pagination) ([]entity.User, string, error) {
		return ctrl.service.ListFollowers(ctx, userID, p)
	})
}
