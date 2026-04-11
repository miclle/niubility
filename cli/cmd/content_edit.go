package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/content"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var contentEditStatus string

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

func init() {
	contentCmd.AddCommand(contentEditCmd)

	contentEditCmd.Flags().StringVarP(&contentEditStatus, "status", "s", "", "Content status (draft/published)")
}

func localizeContentEditCommand() {
	contentEditCmd.Short = localizedText("Content.Edit.Short", "Update content from a Markdown file", nil)
	contentEditCmd.Long = localizedText("Content.Edit.Long", contentEditCmd.Long, nil)
	contentEditCmd.Example = localizedText("Content.Edit.Example", contentEditCmd.Example, nil)

	if flag := contentEditCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("Content.Edit.Flag.Status", "Content status (draft/published)", nil)
	}
}
