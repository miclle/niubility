// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/content"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// content list flags
	contentListLimit    int
	contentListCursor   string
	contentListCategory string
	contentListType     string
	contentListStatus   string
	contentListKeyword  string
	contentListTag      string
	contentListSort     string
	contentListAuthorID string

	// content create flags
	contentCreateStatus string
	contentCreateYes    bool

	// content delete flags
	contentDeleteYes bool
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:   "content",
	Short: "Manage content",
	Long: `Manage content on Niubility platform.

Content types: article, gallery, video
Status: draft, published`,
}

// contentListCmd represents the content list command
var contentListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List contents",
	Long:    `List contents with optional filters.`,
	Example: `  # List all published contents
  niubility content list

  # List articles only
  niubility content list --type article

  # List contents in a category
  niubility content list --category learning

  # Search by keyword
  niubility content list --keyword "golang"`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		// Build options
		opts := &api.ContentListOptions{
			Limit:    contentListLimit,
			Cursor:   contentListCursor,
			Category: contentListCategory,
			Type:     contentListType,
			Status:   contentListStatus,
			Keyword:  contentListKeyword,
			Tag:      contentListTag,
			Sort:     contentListSort,
		}
		if contentListAuthorID != "" {
			opts.AuthorID = contentListAuthorID
		}

		// List contents
		resp, err := apiClient.ListContents(ctx, opts)
		if err != nil {
			return fmt.Errorf("failed to list contents: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Println("No contents found")
			return nil
		}

		// Table output
		table := output.NewTable("ID", "TITLE", "TYPE", "CATEGORY", "STATUS", "AUTHOR", "CREATED")
		for _, c := range resp.Items {
			category := c.Category
			author := ""
			if c.Author != nil {
				author = c.Author.Name
			}
			table.AddRow(
				c.ID,
				output.Truncate(c.Title, 40),
				string(c.Type),
				category,
				string(c.Status),
				author,
				output.FormatTime(c.CreatedAt),
			)
		}
		table.Print()

		// Show pagination info
		if resp.HasMore() {
			fmt.Printf("\nMore results available. Use --cursor %s to get next page.\n", resp.NextCursor)
		}

		return nil
	},
}

// contentViewCmd represents the content view command
var contentViewCmd = &cobra.Command{
	Use:     "view <id>",
	Aliases: []string{"get"},
	Short:   "View content details",
	Long:    `View detailed information about a content item.`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		ctx, cancel := getContext()
		defer cancel()

		c, err := apiClient.GetContent(ctx, id)
		if err != nil {
			return fmt.Errorf("failed to get content: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(c)
		}

		// Pretty print
		fmt.Printf("ID: %s\n", c.ID)
		fmt.Printf("Title: %s\n", c.Title)
		fmt.Printf("Type: %s\n", c.Type)
		fmt.Printf("Status: %s\n", c.Status)
		if c.Category != "" {
			fmt.Printf("Category: %s\n", c.Category)
		}
		if len(c.Tags) > 0 {
			fmt.Printf("Tags: %s\n", strings.Join(c.Tags, ", "))
		}
		if c.Summary != "" {
			fmt.Printf("\nSummary:\n%s\n", c.Summary)
		}
		if c.Author != nil {
			fmt.Printf("\nAuthor: %s\n", c.Author.Name)
		}
		if c.SpeakerName != "" {
			fmt.Printf("Speaker: %s\n", c.SpeakerName)
			if c.SpeakerBio != "" {
				fmt.Printf("Speaker Bio: %s\n", c.SpeakerBio)
			}
		}
		fmt.Printf("\nStats: %d likes, %d favorites\n", c.LikeCount, c.FavoriteCount)

		// For articles, show body preview
		if c.Type == api.ContentTypeArticle && c.Body != "" {
			fmt.Printf("\nBody Preview:\n%s\n", output.Truncate(c.Body, 500))
		}

		// Show attachments
		if len(c.Attachments) > 0 {
			fmt.Printf("\nAttachments (%d):\n", len(c.Attachments))
			for _, att := range c.Attachments {
				cover := ""
				if att.IsCover {
					cover = " [cover]"
				}
				fmt.Printf("  - %s (%s)%s\n", att.Filename, att.Type, cover)
			}
		}

		return nil
	},
}

// contentCreateCmd represents the content create command
var contentCreateCmd = &cobra.Command{
	Use:   "create <type> <file>",
	Short: "Create new content",
	Long: `Create new content from a local file.

For articles, provide a Markdown file with front-matter:
  ---
  title: My Article
  category: learning
  tags: [go, tutorial]
  status: draft
  cover: ./cover.png
  attachments:
    - ./slides.pdf
  ---

  Article content in Markdown...`,
	Example: `  # Create an article from Markdown file
  niubility content create article my-article.md

  # Create with specific status
  niubility content create article my-article.md --status published`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		contentType := args[0]
		filePath := args[1]

		// Validate content type
		if contentType != "article" {
			return fmt.Errorf("only 'article' content type is supported in this version")
		}

		// Parse Markdown file
		article, err := content.ParseMarkdownFile(filePath)
		if err != nil {
			return fmt.Errorf("failed to parse file: %w", err)
		}

		// Override status from flag
		if contentCreateStatus != "" {
			article.Status = api.ContentStatus(contentCreateStatus)
		} else if article.Status == "" {
			article.Status = api.ContentStatus(cfg.DefaultStatus)
		}

		// Get category info (just validate it exists)
		ctx, cancel := getContext()
		defer cancel()

		categories, err := apiClient.ListCategories(ctx)
		if err != nil {
			return fmt.Errorf("failed to get categories: %w", err)
		}

		categoryExists := false
		for _, cat := range categories {
			if cat.Slug == article.CategorySlug {
				categoryExists = true
				break
			}
		}
		if !categoryExists {
			return fmt.Errorf("category '%s' not found", article.CategorySlug)
		}

		// Upload attachments if any
		uploadResult, err := content.UploadAttachments(ctx, apiClient, article, filePath)
		if err != nil {
			return fmt.Errorf("failed to upload attachments: %w", err)
		}

		// Build create request
		req := &api.CreateContentRequest{
			Title:       article.Title,
			Summary:     article.Summary,
			Body:        uploadResult.BodyHTML, // Use body HTML with replaced image URLs
			Type:        api.ContentTypeArticle,
			Status:      article.Status,
			Category:    article.CategorySlug,
			Tags:        article.Tags,
			SpeakerID:   article.SpeakerID,
			SpeakerName: article.SpeakerName,
			SpeakerBio:  article.SpeakerBio,
			Attachments: uploadResult.Attachments,
		}

		if uploadResult.CoverURL != "" {
			req.CoverURL = uploadResult.CoverURL
		}

		// Create content
		created, err := apiClient.CreateContent(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to create content: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(created)
		}

		output.PrintSuccess("Content created successfully")
		fmt.Printf("ID: %s\n", created.ID)
		fmt.Printf("Title: %s\n", created.Title)
		fmt.Printf("Status: %s\n", created.Status)
		fmt.Printf("URL: %s/contents/%s\n", cfg.Server, created.ID)

		return nil
	},
}

// contentDeleteCmd represents the content delete command
var contentDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete content",
	Long:    `Delete a content item by ID.`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		// Confirm deletion
		if !contentDeleteYes {
			ctx, cancel := getContext()
			c, err := apiClient.GetContent(ctx, id)
			cancel()
			if err != nil {
				return fmt.Errorf("failed to get content: %w", err)
			}

			fmt.Printf("Are you sure you want to delete '%s'? [y/N]: ", c.Title)
			var response string
			if _, err := fmt.Scanln(&response); err != nil {
				response = ""
			}
			if strings.ToLower(response) != "y" && strings.ToLower(response) != "yes" {
				fmt.Println("Cancelled")
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteContent(ctx, id); err != nil {
			return fmt.Errorf("failed to delete content: %w", err)
		}

		output.PrintSuccess("Content %s deleted", id)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(contentCmd)
	contentCmd.AddCommand(contentListCmd)
	contentCmd.AddCommand(contentViewCmd)
	contentCmd.AddCommand(contentCreateCmd)
	contentCmd.AddCommand(contentDeleteCmd)

	// content list flags
	contentListCmd.Flags().IntVarP(&contentListLimit, "limit", "l", 20, "Limit number of results")
	contentListCmd.Flags().StringVar(&contentListCursor, "cursor", "", "Pagination cursor")
	contentListCmd.Flags().StringVarP(&contentListCategory, "category", "c", "", "Filter by category slug")
	contentListCmd.Flags().StringVarP(&contentListType, "type", "t", "", "Filter by type (article/gallery/video)")
	contentListCmd.Flags().StringVarP(&contentListStatus, "status", "s", "", "Filter by status (draft/published)")
	contentListCmd.Flags().StringVarP(&contentListKeyword, "keyword", "k", "", "Search by keyword")
	contentListCmd.Flags().StringVar(&contentListTag, "tag", "", "Filter by tag")
	contentListCmd.Flags().StringVar(&contentListSort, "sort", "", "Sort order")
	contentListCmd.Flags().StringVar(&contentListAuthorID, "author-id", "", "Filter by author ID")

	// content create flags
	contentCreateCmd.Flags().StringVarP(&contentCreateStatus, "status", "s", "", "Content status (draft/published)")
	contentCreateCmd.Flags().BoolVarP(&contentCreateYes, "yes", "y", false, "Skip confirmation")

	// content delete flags
	contentDeleteCmd.Flags().BoolVarP(&contentDeleteYes, "yes", "y", false, "Skip confirmation")
}
