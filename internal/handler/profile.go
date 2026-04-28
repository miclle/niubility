// Package handler provides HTTP handlers and route registration.
package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// GetProfile returns the current authenticated user's profile.
func (ctrl *Ctrl) GetProfile(c *fox.Context) (*entity.User, error) {
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}
	user.ResolveAssetURLs()
	return user, nil
}

// UpdateProfile updates the current authenticated user's own profile.
func (ctrl *Ctrl) UpdateProfile(c *fox.Context, args entity.UpdateProfileArgs) (*entity.User, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	updated, err := ctrl.service.UpdateProfile(ctx, user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if updated == nil {
		return nil, httperrors.ErrNotFound
	}

	updated.ResolveAssetURLs()
	return updated, nil
}

// UserProfileResponse represents the response for a user's profile page.
type UserProfileResponse struct {
	User                *entity.User `json:"user"`
	ContentCount        int64        `json:"content_count"`
	TotalLikes          int64        `json:"total_likes"`
	SpeakerContentCount int64        `json:"speaker_content_count"`
	Following           bool         `json:"following"`
}

// GetUserProfile returns a user's public profile with stats.
func (ctrl *Ctrl) GetUserProfile(c *fox.Context) (*UserProfileResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	currentUser := CurrentUser(c)

	username := c.Param("username")
	user, err := ctrl.service.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if user == nil {
		return nil, httperrors.ErrNotFound
	}

	contentCount, _ := ctrl.service.GetUserContentCount(ctx, user.ID)
	totalLikes, _ := ctrl.service.GetUserTotalLikes(ctx, user.ID)
	speakerContentCount, _ := ctrl.service.GetUserSpeakerContentCount(ctx, user.ID)

	// Check if current user is following this user
	following := false
	if currentUser != nil && currentUser.ID != user.ID {
		following, _ = ctrl.service.IsFollowing(ctx, currentUser.ID, user.ID)
	}

	user.ResolveAssetURLs()
	sanitizePublicUser(user)

	return &UserProfileResponse{
		User:                user,
		ContentCount:        contentCount,
		TotalLikes:          totalLikes,
		SpeakerContentCount: speakerContentCount,
		Following:           following,
	}, nil
}
