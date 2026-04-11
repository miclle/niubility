package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/content"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	contentCreateStatus string
	contentCreateYes    bool
)

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

func init() {
	contentCmd.AddCommand(contentCreateCmd)

	contentCreateCmd.Flags().StringVarP(&contentCreateStatus, "status", "s", "", "Content status (draft/published)")
	contentCreateCmd.Flags().BoolVarP(&contentCreateYes, "yes", "y", false, "Skip confirmation")
}

func localizeContentCreateCommand() {
	contentCreateCmd.Short = localizedText("Content.Create.Short", "Create new content", nil)
	contentCreateCmd.Long = localizedText("Content.Create.Long", contentCreateCmd.Long, nil)
	contentCreateCmd.Example = localizedText("Content.Create.Example", contentCreateCmd.Example, nil)

	if flag := contentCreateCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("Content.Create.Flag.Status", "Content status (draft/published)", nil)
	}
	if flag := contentCreateCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
}
