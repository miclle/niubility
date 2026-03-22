package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// resolveUserByUsername looks up a user by the :username route param and returns their ID.
func (ctrl *Ctrl) resolveUserByUsername(c *fox.Context) (string, error) {
	username := c.Param("username")
	if username == "" {
		return "", httperrors.ErrInvalidArguments
	}

	target, err := ctrl.service.GetUserByUsername(username)
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
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	targetID, err := ctrl.resolveUserByUsername(c)
	if err != nil {
		return nil, err
	}

	resp, err := ctrl.service.ToggleFollow(user.ID, targetID)
	if err != nil {
		c.Logger.Errorf("toggle follow: %v", err)
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}

// listFollowUsers is a shared handler for listing following/followers.
func (ctrl *Ctrl) listFollowUsers(c *fox.Context, args entity.Pagination, fetcher func(string, entity.Pagination) ([]entity.User, int64, string, error)) (*ListUsersResponse, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	targetID, err := ctrl.resolveUserByUsername(c)
	if err != nil {
		return nil, err
	}

	users, total, nextCursor, err := fetcher(targetID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range users {
		users[i].ResolveAssetURLs()
	}

	args.Total = total
	args.NextCursor = nextCursor
	return &ListUsersResponse{Users: users, Pagination: args}, nil
}

// ListFollowing returns the list of users that the target user is following.
func (ctrl *Ctrl) ListFollowing(c *fox.Context, args entity.Pagination) (*ListUsersResponse, error) {
	return ctrl.listFollowUsers(c, args, ctrl.service.ListFollowing)
}

// ListFollowers returns the list of users who follow the target user.
func (ctrl *Ctrl) ListFollowers(c *fox.Context, args entity.Pagination) (*ListUsersResponse, error) {
	return ctrl.listFollowUsers(c, args, ctrl.service.ListFollowers)
}
