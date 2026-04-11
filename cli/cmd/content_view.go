package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

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

func init() {
	contentCmd.AddCommand(contentViewCmd)
}

func localizeContentViewCommand() {
	contentViewCmd.Short = localizedText("Content.View.Short", "View content details", nil)
	contentViewCmd.Long = localizedText("Content.View.Long", "View detailed information about a content item.", nil)
}
