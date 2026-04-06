// Package cmd provides CLI commands
package cmd

import (
	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// favorite list flags
	favoriteListLimit  int
	favoriteListCursor string
)

// favoriteCmd represents the favorite command
var favoriteCmd = &cobra.Command{
	Use:     "favorite",
	Aliases: []string{"fav"},
	Short:   "Manage favorites",
	Long:    `Manage your favorited content items.`,
}

// favoriteListCmd represents the favorite list command
var favoriteListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List favorites",
	Long:    `List your favorited content items.`,
	Example: `  # List your favorites
  niubility favorite list

  # List with pagination
  niubility favorite list --limit 10`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		opts := &api.PaginationOptions{
			Limit:  favoriteListLimit,
			Cursor: favoriteListCursor,
		}

		resp, err := apiClient.ListFavorites(ctx, opts)
		if err != nil {
			return wrapLocalizedError("Favorite.List.Error.ListFailed", "failed to list favorites", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("Favorite.List.Empty", "No favorites found", nil)
			return nil
		}

		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Title", "TITLE", nil),
			localizedText("Common.Label.Type", "TYPE", nil),
			localizedText("Common.Label.Category", "CATEGORY", nil),
			localizedText("Common.Label.Status", "STATUS", nil),
			localizedText("Common.Label.Author", "AUTHOR", nil),
		)
		for _, c := range resp.Items {
			author := ""
			if c.Author != nil {
				author = c.Author.Name
			}
			table.AddRow(
				c.ID,
				output.Truncate(c.Title, 40),
				string(c.Type),
				c.Category,
				string(c.Status),
				author,
			)
		}
		table.Print()

		if resp.HasMore() {
			printPagination(resp.NextCursor)
		}

		return nil
	},
}

// favoriteToggleCmd represents the favorite toggle command
var favoriteToggleCmd = &cobra.Command{
	Use:   "toggle <id>",
	Short: "Toggle favorite on a content item",
	Long:  `Toggle favorite on a content item. Same command to favorite or unfavorite.`,
	Args:  cobra.ExactArgs(1),
	Example: `  # Favorite a content item
  niubility favorite toggle 123

  # Unfavorite (same command toggles)
  niubility favorite toggle 123`,
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ToggleFavorite(ctx, id)
		if err != nil {
			return wrapLocalizedError("Favorite.Toggle.Error.ToggleFailed", "failed to toggle favorite", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := localizedText("Favorite.Toggle.State.Unfavorited", "unfavorited", nil)
		if resp.Favorited {
			state = localizedText("Favorite.Toggle.State.Favorited", "favorited", nil)
		}
		output.PrintSuccessT(
			"Favorite.Toggle.Success",
			"{{.State}} content {{.ID}} (total: {{.Total}})",
			map[string]interface{}{"State": state, "ID": id, "Total": resp.FavoriteCount},
		)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(favoriteCmd)
	favoriteCmd.AddCommand(favoriteListCmd)
	favoriteCmd.AddCommand(favoriteToggleCmd)

	favoriteListCmd.Flags().IntVarP(&favoriteListLimit, "limit", "l", 20, "Limit number of results")
	favoriteListCmd.Flags().StringVar(&favoriteListCursor, "cursor", "", "Pagination cursor")
}

func localizeFavoriteCommands() {
	favoriteCmd.Short = localizedText("Favorite.Short", "Manage favorites", nil)
	favoriteCmd.Long = localizedText("Favorite.Long", "Manage your favorited content items.", nil)

	favoriteListCmd.Short = localizedText("Favorite.List.Short", "List favorites", nil)
	favoriteListCmd.Long = localizedText("Favorite.List.Long", "List your favorited content items.", nil)
	favoriteListCmd.Example = localizedText("Favorite.List.Example", favoriteListCmd.Example, nil)

	favoriteToggleCmd.Short = localizedText("Favorite.Toggle.Short", "Toggle favorite on a content item", nil)
	favoriteToggleCmd.Long = localizedText("Favorite.Toggle.Long", "Toggle favorite on a content item. Same command to favorite or unfavorite.", nil)
	favoriteToggleCmd.Example = localizedText("Favorite.Toggle.Example", favoriteToggleCmd.Example, nil)

	if flag := favoriteListCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Limit", "Limit number of results", nil)
	}
	if flag := favoriteListCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Cursor", "Pagination cursor", nil)
	}
}
