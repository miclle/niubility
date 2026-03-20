package entity

import "strings"

// FileURLPrefix is the URL path prefix for accessing uploaded assets via backend presigned redirect.
const FileURLPrefix = "/api/v1/assets/"

// ResolveFileURL converts an S3 object key to an accessible URL path.
// Returns the key unchanged if empty or already a full URL / absolute path.
func ResolveFileURL(key string) string {
	if key == "" {
		return ""
	}
	if strings.HasPrefix(key, "http://") || strings.HasPrefix(key, "https://") || strings.HasPrefix(key, "/") {
		return key
	}
	return FileURLPrefix + key
}

// ResolveFileURLs converts S3 object keys in User fields to accessible URL paths.
func (u *User) ResolveFileURLs() {
	if u == nil {
		return
	}
	u.Avatar = ResolveFileURL(u.Avatar)
}

// ResolveFileURLs converts S3 object keys in Content fields to accessible URL paths.
func (c *Content) ResolveFileURLs() {
	if c == nil {
		return
	}
	c.CoverURL = ResolveFileURL(c.CoverURL)
	c.VideoURL = ResolveFileURL(c.VideoURL)
	if c.Author != nil {
		c.Author.ResolveFileURLs()
	}
	if c.Speaker != nil {
		c.Speaker.ResolveFileURLs()
	}
}

// ResolveFileURLs converts S3 object keys in Comment fields to accessible URL paths.
func (c *Comment) ResolveFileURLs() {
	if c == nil {
		return
	}
	if c.User != nil {
		c.User.ResolveFileURLs()
	}
	if c.ReplyTo != nil {
		c.ReplyTo.ResolveFileURLs()
	}
	for i := range c.Replies {
		c.Replies[i].ResolveFileURLs()
	}
}
