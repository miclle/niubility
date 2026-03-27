// Package content provides content parsing and processing utilities
package content

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gomarkdown/markdown"
	"github.com/gomarkdown/markdown/html"
	"github.com/gomarkdown/markdown/parser"
	"github.com/miclle/niubility-cli/internal/api"
	"gopkg.in/yaml.v3"
)

// Article represents a parsed article from Markdown file
type Article struct {
	// Title is the article title
	Title string

	// Summary is the article summary
	Summary string

	// CategorySlug is the category slug
	CategorySlug string

	// Tags are the article tags
	Tags []string

	// Status is the content status
	Status api.ContentStatus

	// CoverPath is the local path to cover image
	CoverPath string

	// Attachments are local paths to attachments
	Attachments []string

	// SpeakerID is the speaker user ID
	SpeakerID string

	// SpeakerName is the speaker name
	SpeakerName string

	// SpeakerBio is the speaker bio
	SpeakerBio string

	// BodyMarkdown is the raw Markdown content
	BodyMarkdown string

	// BodyHTML is the converted HTML content
	BodyHTML string

	// ImagePaths are local image paths found in the body
	ImagePaths []string
}

// FrontMatter represents YAML front-matter
type FrontMatter struct {
	Title       string   `yaml:"title"`
	Summary     string   `yaml:"summary"`
	Category    string   `yaml:"category"`
	Tags        []string `yaml:"tags"`
	Status      string   `yaml:"status"`
	Cover       string   `yaml:"cover"`
	Attachments []string `yaml:"attachments"`
	SpeakerID   string   `yaml:"speaker_id"`
	SpeakerName string   `yaml:"speaker_name"`
	SpeakerBio  string   `yaml:"speaker_bio"`
}

// Errors
var (
	ErrEmptyTitle    = errors.New("title is required in front-matter")
	ErrEmptyCategory = errors.New("category is required in front-matter")
)

// ParseMarkdownFile parses a Markdown file with front-matter
func ParseMarkdownFile(path string) (*Article, error) {
	// Read file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	// Parse front-matter and body
	fm, body, err := parseFrontMatter(data)
	if err != nil {
		return nil, err
	}

	// Validate required fields
	if fm.Title == "" {
		return nil, ErrEmptyTitle
	}
	if fm.Category == "" {
		return nil, ErrEmptyCategory
	}

	// Get base directory for resolving relative paths
	baseDir := filepath.Dir(path)

	// Resolve relative paths
	coverPath := ""
	if fm.Cover != "" {
		coverPath = resolvePath(fm.Cover, baseDir)
		if _, err := os.Stat(coverPath); os.IsNotExist(err) {
			return nil, fmt.Errorf("cover file not found: %s", coverPath)
		}
	}

	var attachmentPaths []string
	for _, att := range fm.Attachments {
		ap := resolvePath(att, baseDir)
		if _, err := os.Stat(ap); os.IsNotExist(err) {
			return nil, fmt.Errorf("attachment file not found: %s", ap)
		}
		attachmentPaths = append(attachmentPaths, ap)
	}

	// Extract image paths from body
	imagePaths := extractImagePaths(body)

	// Resolve image paths
	var resolvedImagePaths []string
	for _, imgPath := range imagePaths {
		// Only process local paths (not URLs)
		if !isURL(imgPath) {
			rp := resolvePath(imgPath, baseDir)
			if _, err := os.Stat(rp); os.IsNotExist(err) {
				return nil, fmt.Errorf("image file not found: %s", rp)
			}
			resolvedImagePaths = append(resolvedImagePaths, rp)
		}
	}

	// Convert Markdown to HTML
	bodyHTML := markdownToHTML(body)

	// Validate status
	status := api.ContentStatusDraft
	if fm.Status != "" {
		if fm.Status != "draft" && fm.Status != "published" {
			return nil, fmt.Errorf("invalid status '%s', must be 'draft' or 'published'", fm.Status)
		}
		status = api.ContentStatus(fm.Status)
	}

	return &Article{
		Title:        fm.Title,
		Summary:      fm.Summary,
		CategorySlug: fm.Category,
		Tags:         fm.Tags,
		Status:       status,
		CoverPath:    coverPath,
		Attachments:  attachmentPaths,
		SpeakerID:    fm.SpeakerID,
		SpeakerName:  fm.SpeakerName,
		SpeakerBio:   fm.SpeakerBio,
		BodyMarkdown: body,
		BodyHTML:     bodyHTML,
		ImagePaths:   resolvedImagePaths,
	}, nil
}

// parseFrontMatter parses YAML front-matter from content
func parseFrontMatter(data []byte) (*FrontMatter, string, error) {
	// Check for front-matter delimiters
	if !bytes.HasPrefix(data, []byte("---\n")) {
		return &FrontMatter{}, string(data), nil
	}

	// Find end delimiter
	endIndex := bytes.Index(data[4:], []byte("\n---"))
	if endIndex == -1 {
		return &FrontMatter{}, string(data), nil
	}

	// Parse YAML
	fmData := data[4 : endIndex+4]
	var fm FrontMatter
	if err := yaml.Unmarshal(fmData, &fm); err != nil {
		return nil, "", fmt.Errorf("failed to parse front-matter: %w", err)
	}

	// Get body (skip the closing --- and newline)
	body := string(data[endIndex+8:])

	return &fm, strings.TrimSpace(body), nil
}

// markdownToHTML converts Markdown to HTML
func markdownToHTML(md string) string {
	// Create parser with extensions
	extensions := parser.CommonExtensions | parser.AutoHeadingIDs | parser.NoEmptyLineBeforeBlock
	p := parser.NewWithExtensions(extensions)

	// Parse Markdown
	doc := p.Parse([]byte(md))

	// Create HTML renderer
	opts := html.RendererOptions{
		Flags: html.CommonFlags | html.HrefTargetBlank,
	}
	renderer := html.NewRenderer(opts)

	// Render HTML
	htmlBytes := markdown.Render(doc, renderer)
	return string(htmlBytes)
}

// extractImagePaths extracts local image paths from Markdown content
func extractImagePaths(content string) []string {
	// Match Markdown image syntax: ![alt](path)
	re := regexp.MustCompile(`!\[([^\]]*)\]\(([^)]+)\)`)
	matches := re.FindAllStringSubmatch(content, -1)

	var paths []string
	for _, match := range matches {
		if len(match) > 2 {
			paths = append(paths, match[2])
		}
	}

	return paths
}

// isURL checks if a string is a URL
func isURL(s string) bool {
	return strings.HasPrefix(s, "http://") ||
		strings.HasPrefix(s, "https://") ||
		strings.HasPrefix(s, "data:")
}

// resolvePath resolves a relative path to absolute path
func resolvePath(path string, baseDir string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(baseDir, path)
}
