package handler

import (
	"time"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"

	"github.com/miclle/niubility/internal/entity"
)

// RecordContentViewArgs represents the request body for recording a browsing event.
type RecordContentViewArgs struct {
	Trigger string `json:"trigger"`
}

// MyContentViewItem represents a browsing history entry in the current user's list.
type MyContentViewItem struct {
	Content       entity.Content `json:"content"`
	FirstViewedAt string         `json:"first_viewed_at"`
	LastViewedAt  string         `json:"last_viewed_at"`
	ViewCount     int64          `json:"view_count"`
}

// ListMyContentViewsResponse represents the response for listing the current user's browsing history.
type ListMyContentViewsResponse struct {
	Items      []MyContentViewItem `json:"items"`
	NextCursor string              `json:"next_cursor,omitempty"`
}

// ContentViewUserItem represents a browsing history entry in a content's viewer list.
type ContentViewUserItem struct {
	User          entity.User `json:"user"`
	FirstViewedAt string      `json:"first_viewed_at"`
	LastViewedAt  string      `json:"last_viewed_at"`
	ViewCount     int64       `json:"view_count"`
}

// ListContentViewUsersResponse represents the response for listing a content's viewers.
type ListContentViewUsersResponse struct {
	Items      []ContentViewUserItem `json:"items"`
	NextCursor string                `json:"next_cursor,omitempty"`
}

// RecordContentView stores the current user's browsing record for a content item.
func (ctrl *Ctrl) RecordContentView(c *fox.Context, args RecordContentViewArgs) (map[string]bool, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	contentID := c.Param("id")
	content, err := ctrl.service.GetContentByID(ctx, contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}
	if !ctrl.service.CanUserAccessContent(user, content) {
		return nil, httperrors.ErrNotFound
	}

	if err := ctrl.service.RecordContentView(ctx, user.ID, contentID); err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	return map[string]bool{"ok": true}, nil
}

// ListMyContentViews returns the current user's browsing history.
func (ctrl *Ctrl) ListMyContentViews(c *fox.Context, args entity.ListMyContentViewsArgs) (*ListMyContentViewsResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	user := CurrentUser(c)
	if user == nil {
		return nil, httperrors.ErrUnauthorized
	}

	items, nextCursor, err := ctrl.service.ListMyContentViews(ctx, user.ID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	respItems := make([]MyContentViewItem, 0, len(items))
	for _, item := range items {
		item.Content.ResolveAssetURLs()
		respItems = append(respItems, MyContentViewItem{
			Content:       item.Content,
			FirstViewedAt: item.FirstViewedAt.Format(time.RFC3339Nano),
			LastViewedAt:  item.LastViewedAt.Format(time.RFC3339Nano),
			ViewCount:     item.ViewCount,
		})
	}

	return &ListMyContentViewsResponse{
		Items:      respItems,
		NextCursor: nextCursor,
	}, nil
}

// ListContentViewUsers returns the browsing users for a content item (admin only).
func (ctrl *Ctrl) ListContentViewUsers(c *fox.Context, args entity.Pagination) (*ListContentViewUsersResponse, error) {
	ctx := c.Logger.WithContext(c.Request.Context())
	contentID := c.Param("id")

	content, err := ctrl.service.GetContentByID(ctx, contentID)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}
	if content == nil {
		return nil, httperrors.ErrNotFound
	}

	items, nextCursor, err := ctrl.service.ListContentViewUsers(ctx, contentID, args)
	if err != nil {
		return nil, httperrors.ErrInternalServerError
	}

	respItems := make([]ContentViewUserItem, 0, len(items))
	for _, item := range items {
		respItems = append(respItems, ContentViewUserItem{
			User:          item.User,
			FirstViewedAt: item.FirstViewedAt.Format(time.RFC3339Nano),
			LastViewedAt:  item.LastViewedAt.Format(time.RFC3339Nano),
			ViewCount:     item.ViewCount,
		})
	}

	return &ListContentViewUsersResponse{
		Items:      respItems,
		NextCursor: nextCursor,
	}, nil
}
