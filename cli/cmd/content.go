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

	// content edit flags
	contentEditStatus string

	// content delete flags
	contentDeleteYes bool
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:     "content",
	Aliases: []string{"cnt"},
	Short:   "Manage content",
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
			return wrapLocalizedError("Content.List.Error.ListFailed", "failed to list contents", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("Content.List.Empty", "No contents found", nil)
			return nil
		}

		// Table output
		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Title", "TITLE", nil),
			localizedText("Common.Label.Type", "TYPE", nil),
			localizedText("Common.Label.Category", "CATEGORY", nil),
			localizedText("Common.Label.Status", "STATUS", nil),
			localizedText("Common.Label.Author", "AUTHOR", nil),
			localizedText("Common.Label.Created", "CREATED", nil),
		)
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
			printPagination(resp.NextCursor)
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
			return wrapLocalizedError("Content.View.Error.GetFailed", "failed to get content", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(c)
		}

		// Pretty print
		printLocalizedField("Common.Label.Identifier", "ID", c.ID)
		printLocalizedField("Common.Label.Title", "Title", c.Title)
		printLocalizedField("Common.Label.Type", "Type", string(c.Type))
		printLocalizedField("Common.Label.Status", "Status", string(c.Status))
		if c.Category != "" {
			printLocalizedField("Common.Label.Category", "Category", c.Category)
		}
		if len(c.Tags) > 0 {
			printLocalizedField("Common.Label.Tags", "Tags", strings.Join(c.Tags, ", "))
		}
		if c.Summary != "" {
			fmt.Printf("\n%s:\n%s\n", localizedText("Common.Label.Summary", "Summary", nil), c.Summary)
		}
		if c.Author != nil {
			fmt.Printf("\n%s: %s\n", localizedText("Common.Label.Author", "Author", nil), c.Author.Name)
		}
		if c.SpeakerName != "" {
			printLocalizedField("Common.Label.Speaker", "Speaker", c.SpeakerName)
			if c.SpeakerBio != "" {
				printLocalizedField("Common.Label.SpeakerBio", "Speaker Bio", c.SpeakerBio)
			}
		}
		fmt.Printf(
			"\n%s: %d %s, %d %s\n",
			localizedText("Common.Label.Stats", "Stats", nil),
			c.LikeCount,
			localizedText("Common.Label.Likes", "likes", nil),
			c.FavoriteCount,
			localizedText("Common.Label.Favorites", "favorites", nil),
		)

		// For articles, show body preview
		if c.Type == api.ContentTypeArticle && c.Body != "" {
			fmt.Printf("\n%s:\n%s\n", localizedText("Common.Label.BodyPreview", "Body Preview", nil), output.Truncate(c.Body, 500))
		}

		// Show attachments
		if len(c.Attachments) > 0 {
			fmt.Printf("\n%s:\n", localizedText("Content.View.Attachments", "Attachments ({{.Count}})", map[string]interface{}{"Count": len(c.Attachments)}))
			for _, att := range c.Attachments {
				cover := ""
				if att.IsCover {
					cover = localizedText("Content.View.CoverSuffix", " [cover]", nil)
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
			return localizedError("Content.Create.Error.UnsupportedType", "only 'article' content type is supported in this version")
		}

		// Parse Markdown file
		article, err := content.ParseMarkdownFile(filePath)
		if err != nil {
			return wrapLocalizedError("Content.Create.Error.ParseFailed", "failed to parse file", err)
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
			return wrapLocalizedError("Content.Create.Error.CategoriesFailed", "failed to get categories", err)
		}

		categoryExists := false
		for _, cat := range categories {
			if cat.Slug == article.CategorySlug {
				categoryExists = true
				break
			}
		}
		if !categoryExists {
			return fmt.Errorf("%s", localizedText("Content.Create.Error.CategoryNotFound", "category '{{.Slug}}' not found", map[string]interface{}{"Slug": article.CategorySlug}))
		}

		// Upload attachments if any
		uploadResult, err := content.UploadAttachments(ctx, apiClient, article, filePath)
		if err != nil {
			return wrapLocalizedError("Content.Create.Error.UploadFailed", "failed to upload attachments", err)
		}

		// Build create request
		req := &api.CreateContentRequest{
			Title:       article.Title,
			Summary:     article.Summary,
			Body:        uploadResult.BodyHTML,
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
			return wrapLocalizedError("Content.Create.Error.CreateFailed", "failed to create content", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(created)
		}

		output.PrintSuccessT("Content.Create.Success.Created", "Content created successfully", nil)
		printLocalizedField("Common.Label.Identifier", "ID", created.ID)
		printLocalizedField("Common.Label.Title", "Title", created.Title)
		printLocalizedField("Common.Label.Status", "Status", string(created.Status))
		printLocalizedField("Common.Label.URL", "URL", fmt.Sprintf("%s/contents/%s", cfg.Server, created.ID))

		return nil
	},
}

// contentEditCmd represents the content edit command
var contentEditCmd = &cobra.Command{
	Use:   "edit <id> <file>",
	Short: "Update content from a Markdown file",
	Long: `Update an existing content item from a Markdown file.

The Markdown file supports the same front-matter format as "content create".
Only fields present in the front-matter will be updated; omitted fields remain unchanged.`,
	Example: `  # Update an article from Markdown file
  niubility content edit 123 my-article.md

  # Update with specific status
  niubility content edit 123 my-article.md --status published`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		filePath := args[1]

		// Parse Markdown file (partial - no required field validation)
		article, err := content.ParseMarkdownFilePartial(filePath)
		if err != nil {
			return wrapLocalizedError("Content.Edit.Error.ParseFailed", "failed to parse file", err)
		}

		ctx, cancel := getContext()
		defer cancel()

		// Validate category if provided
		if article.CategorySlug != "" {
			categories, err := apiClient.ListCategories(ctx)
			if err != nil {
				return wrapLocalizedError("Content.Edit.Error.CategoriesFailed", "failed to get categories", err)
			}
			categoryExists := false
			for _, cat := range categories {
				if cat.Slug == article.CategorySlug {
					categoryExists = true
					break
				}
			}
			if !categoryExists {
				return fmt.Errorf("%s", localizedText("Content.Edit.Error.CategoryNotFound", "category '{{.Slug}}' not found", map[string]interface{}{"Slug": article.CategorySlug}))
			}
		}

		// Upload attachments if any
		uploadResult, err := content.UploadAttachments(ctx, apiClient, article, filePath)
		if err != nil {
			return wrapLocalizedError("Content.Edit.Error.UploadFailed", "failed to upload attachments", err)
		}

		// Build update request - only set fields that were provided in front-matter
		req := &api.UpdateContentRequest{}

		if article.Title != "" {
			req.Title = &article.Title
		}
		if article.Summary != "" {
			req.Summary = &article.Summary
		}
		if uploadResult.BodyHTML != "" {
			req.Body = &uploadResult.BodyHTML
		}
		if uploadResult.CoverURL != "" {
			req.CoverURL = &uploadResult.CoverURL
		}
		if article.CategorySlug != "" {
			req.Category = &article.CategorySlug
		}
		if article.Tags != nil {
			req.Tags = article.Tags
		}
		if article.SpeakerID != "" {
			req.SpeakerID = &article.SpeakerID
		}
		if article.SpeakerName != "" {
			req.SpeakerName = &article.SpeakerName
		}
		if article.SpeakerBio != "" {
			req.SpeakerBio = &article.SpeakerBio
		}
		if uploadResult.Attachments != nil {
			req.Attachments = uploadResult.Attachments
		}

		// Override status from flag or front-matter
		if contentEditStatus != "" {
			s := api.ContentStatus(contentEditStatus)
			req.Status = &s
		} else if article.Status != "" {
			req.Status = (*api.ContentStatus)(&article.Status)
		}

		// Update content
		updated, err := apiClient.UpdateContent(ctx, id, req)
		if err != nil {
			return wrapLocalizedError("Content.Edit.Error.UpdateFailed", "failed to update content", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccessT("Content.Edit.Success.Updated", "Content updated successfully", nil)
		printLocalizedField("Common.Label.Identifier", "ID", updated.ID)
		printLocalizedField("Common.Label.Title", "Title", updated.Title)
		printLocalizedField("Common.Label.Status", "Status", string(updated.Status))
		printLocalizedField("Common.Label.URL", "URL", fmt.Sprintf("%s/contents/%s", cfg.Server, updated.ID))

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
				return wrapLocalizedError("Content.Delete.Error.GetFailed", "failed to get content", err)
			}

			if !confirmAction("Content.Delete.Prompt", "Are you sure you want to delete '{{.Title}}'? [y/N]: ", map[string]interface{}{"Title": c.Title}) {
				printLocalizedMessage("Common.Message.Cancelled", "Cancelled", nil)
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteContent(ctx, id); err != nil {
			return wrapLocalizedError("Content.Delete.Error.DeleteFailed", "failed to delete content", err)
		}

		output.PrintSuccessT("Content.Delete.Success.Deleted", "Content {{.ID}} deleted", map[string]interface{}{"ID": id})
		return nil
	},
}

func init() {
	rootCmd.AddCommand(contentCmd)
	contentCmd.AddCommand(contentListCmd)
	contentCmd.AddCommand(contentViewCmd)
	contentCmd.AddCommand(contentCreateCmd)
	contentCmd.AddCommand(contentEditCmd)
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

	// content edit flags
	contentEditCmd.Flags().StringVarP(&contentEditStatus, "status", "s", "", "Content status (draft/published)")

	// content delete flags
	contentDeleteCmd.Flags().BoolVarP(&contentDeleteYes, "yes", "y", false, "Skip confirmation")
}

func localizeContentCommands() {
	contentCmd.Short = localizedText("Content.Short", "Manage content", nil)
	contentCmd.Long = localizedText("Content.Long", contentCmd.Long, nil)

	contentListCmd.Short = localizedText("Content.List.Short", "List contents", nil)
	contentListCmd.Long = localizedText("Content.List.Long", "List contents with optional filters.", nil)
	contentListCmd.Example = localizedText("Content.List.Example", contentListCmd.Example, nil)

	contentViewCmd.Short = localizedText("Content.View.Short", "View content details", nil)
	contentViewCmd.Long = localizedText("Content.View.Long", "View detailed information about a content item.", nil)

	contentCreateCmd.Short = localizedText("Content.Create.Short", "Create new content", nil)
	contentCreateCmd.Long = localizedText("Content.Create.Long", contentCreateCmd.Long, nil)
	contentCreateCmd.Example = localizedText("Content.Create.Example", contentCreateCmd.Example, nil)

	contentEditCmd.Short = localizedText("Content.Edit.Short", "Update content from a Markdown file", nil)
	contentEditCmd.Long = localizedText("Content.Edit.Long", contentEditCmd.Long, nil)
	contentEditCmd.Example = localizedText("Content.Edit.Example", contentEditCmd.Example, nil)

	contentDeleteCmd.Short = localizedText("Content.Delete.Short", "Delete content", nil)
	contentDeleteCmd.Long = localizedText("Content.Delete.Long", "Delete a content item by ID.", nil)

	if flag := contentListCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Limit", "Limit number of results", nil)
	}
	if flag := contentListCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Cursor", "Pagination cursor", nil)
	}
	if flag := contentListCmd.Flags().Lookup("category"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Category", "Filter by category slug", nil)
	}
	if flag := contentListCmd.Flags().Lookup("type"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Type", "Filter by type (article/gallery/video)", nil)
	}
	if flag := contentListCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Status", "Filter by status (draft/published)", nil)
	}
	if flag := contentListCmd.Flags().Lookup("keyword"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Keyword", "Search by keyword", nil)
	}
	if flag := contentListCmd.Flags().Lookup("tag"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Tag", "Filter by tag", nil)
	}
	if flag := contentListCmd.Flags().Lookup("sort"); flag != nil {
		flag.Usage = localizedText("Content.Flag.Sort", "Sort order", nil)
	}
	if flag := contentListCmd.Flags().Lookup("author-id"); flag != nil {
		flag.Usage = localizedText("Content.Flag.AuthorID", "Filter by author ID", nil)
	}
	if flag := contentCreateCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("Content.Create.Flag.Status", "Content status (draft/published)", nil)
	}
	if flag := contentCreateCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
	if flag := contentEditCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("Content.Edit.Flag.Status", "Content status (draft/published)", nil)
	}
	if flag := contentDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
}
