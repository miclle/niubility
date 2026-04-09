package entity

import (
	"net/url"
	"strings"
)

func normalizeStoredURL(value, prefix string) string {
	if value == "" || strings.HasPrefix(value, prefix) {
		return value
	}
	if !strings.HasPrefix(value, "http://") && !strings.HasPrefix(value, "https://") {
		return value
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return value
	}
	if !strings.HasPrefix(parsed.Path, prefix) {
		return value
	}

	normalized := parsed.Path
	if parsed.RawQuery != "" {
		normalized += "?" + parsed.RawQuery
	}
	if parsed.Fragment != "" {
		normalized += "#" + parsed.Fragment
	}

	return normalized
}

// resolveURL converts an S3 object key to an accessible URL path with the given route prefix.
// Returns the key unchanged if empty or already a full URL / absolute path.
func resolveURL(key, prefix string) string {
	key = normalizeStoredURL(key, prefix)
	if key == "" {
		return ""
	}
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") || strings.HasPrefix(key, "/") {
		return key
	}
	return prefix + key
}

// AvatarURL converts an avatar S3 key to an accessible URL path.
func AvatarURL(key string) string {
	return resolveURL(key, "/avatars/")
}

// NormalizeAvatarStorageURL normalizes legacy absolute avatar URLs to route-relative paths.
func NormalizeAvatarStorageURL(value string) string {
	return normalizeStoredURL(value, "/avatars/")
}

// AttachmentURL converts an attachment S3 key to an accessible URL path.
func AttachmentURL(key string) string {
	return resolveURL(key, "/attachments/")
}

// NormalizeAttachmentStorageURL normalizes legacy absolute attachment URLs to route-relative paths.
func NormalizeAttachmentStorageURL(value string) string {
	return resolveURL(value, "/attachments/")
}

// ResolveAssetURLs converts S3 object keys in User fields to accessible URL paths.
func (u *User) ResolveAssetURLs() {
	if u == nil {
		return
	}
	u.Avatar = resolveURL(u.Avatar, "/avatars/")
}

// ResolveAssetURLs converts S3 object keys in Content fields to accessible URL paths.
func (c *Content) ResolveAssetURLs() {
	if c == nil {
		return
	}
	c.CoverURL = resolveURL(c.CoverURL, "/attachments/")
	if c.Author != nil {
		c.Author.ResolveAssetURLs()
	}
	if c.Speaker != nil {
		c.Speaker.ResolveAssetURLs()
	}
	for i := range c.Attachments {
		c.Attachments[i].URL = resolveURL(c.Attachments[i].URL, "/attachments/")
		c.Attachments[i].CoverURL = resolveURL(c.Attachments[i].CoverURL, "/attachments/")
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
