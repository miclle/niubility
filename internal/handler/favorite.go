package handler

import (
	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// FavoriteContent toggles favorite on a content item.
func (ctrl *Ctrl) FavoriteContent(c *fox.Context) (*entity.FavoriteResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	contentID := c.Param("id")
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	content, err := ctrl.service.GetContentByID(ctx, contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	resp, err := ctrl.service.ToggleFavorite(ctx, user.ID, contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return resp, nil
}

// ListFavorites returns a paginated list of contents favorited by the current user.
func (ctrl *Ctrl) ListFavorites(c *fox.Context, args entity.Pagination) (*ListContentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	contents, nextCursor, err := ctrl.service.ListFavorites(ctx, user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range contents {
		contents[i].ResolveAssetURLs()
	}

	return &ListContentsResponse{
		Items:      contents,
		NextCursor: nextCursor,
	}, nil
}

// ListUserFavorites returns a paginated list of contents favorited by a specific user (by username).
func (ctrl *Ctrl) ListUserFavorites(c *fox.Context, args entity.Pagination) (*ListContentsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())

	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	targetID, err := ctrl.resolveUserByUsername(c)
	if err != nil {
		return nil, err
	}

	contents, nextCursor, err := ctrl.service.ListFavorites(ctx, targetID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	for i := range contents {
		contents[i].ResolveAssetURLs()
	}

	return &ListContentsResponse{
		Items:      contents,
		NextCursor: nextCursor,
	}, nil
}
