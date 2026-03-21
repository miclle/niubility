package entity

import "strings"

// AssetURLPrefix is the URL path prefix for accessing uploaded assets via backend presigned redirect.
const AssetURLPrefix = "/api/v1/assets/"

// ResolveAssetURL converts an S3 object key to an accessible URL path.
// Returns the key unchanged if empty or already a full URL / absolute path.
func ResolveAssetURL(key string) string {
	if key == "" {
		return ""
	}
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") || strings.HasPrefix(key, "/") {
		return key
	}
	return AssetURLPrefix + key
}

// ResolveAssetURLs converts S3 object keys in User fields to accessible URL paths.
func (u *User) ResolveAssetURLs() {
	if u == nil {
		return
	}
	u.Avatar = ResolveAssetURL(u.Avatar)
}

// ResolveAssetURLs converts S3 object keys in Content fields to accessible URL paths.
func (c *Content) ResolveAssetURLs() {
	if c == nil {
		return
	}
	c.CoverURL = ResolveAssetURL(c.CoverURL)
	if c.Author != nil {
		c.Author.ResolveAssetURLs()
	}
	if c.Speaker != nil {
		c.Speaker.ResolveAssetURLs()
	}
	for i := range c.Attachments {
		c.Attachments[i].URL = ResolveAssetURL(c.Attachments[i].URL)
	}
}

// ResolveAssetURLs converts S3 object keys in Comment fields to accessible URL paths.
func (c *Comment) ResolveAssetURLs() {
	if c == nil {
		return
	}
	if c.User != nil {
		c.User.ResolveAssetURLs()
	}
	if c.ReplyTo != nil {
		c.ReplyTo.ResolveAssetURLs()
	}
	for i := range c.Replies {
		c.Replies[i].ResolveAssetURLs()
	}
}
