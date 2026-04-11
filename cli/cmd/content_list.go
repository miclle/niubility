package cmd

import (
	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	contentListLimit    int
	contentListCursor   string
	contentListCategory string
	contentListType     string
	contentListStatus   string
	contentListKeyword  string
	contentListTag      string
	contentListSort     string
	contentListAuthorID string
)

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

func init() {
	contentCmd.AddCommand(contentListCmd)

	contentListCmd.Flags().IntVarP(&contentListLimit, "limit", "l", 20, "Limit number of results")
	contentListCmd.Flags().StringVar(&contentListCursor, "cursor", "", "Pagination cursor")
	contentListCmd.Flags().StringVarP(&contentListCategory, "category", "c", "", "Filter by category slug")
	contentListCmd.Flags().StringVarP(&contentListType, "type", "t", "", "Filter by type (article/gallery/video)")
	contentListCmd.Flags().StringVarP(&contentListStatus, "status", "s", "", "Filter by status (draft/published)")
	contentListCmd.Flags().StringVarP(&contentListKeyword, "keyword", "k", "", "Search by keyword")
	contentListCmd.Flags().StringVar(&contentListTag, "tag", "", "Filter by tag")
	contentListCmd.Flags().StringVar(&contentListSort, "sort", "", "Sort order")
	contentListCmd.Flags().StringVar(&contentListAuthorID, "author-id", "", "Filter by author ID")
}

func localizeContentListCommand() {
	contentListCmd.Short = localizedText("Content.List.Short", "List contents", nil)
	contentListCmd.Long = localizedText("Content.List.Long", "List contents with optional filters.", nil)
	contentListCmd.Example = localizedText("Content.List.Example", contentListCmd.Example, nil)

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
}
