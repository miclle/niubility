// Package cmd provides CLI commands
package cmd

import (
	"fmt"

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
			return fmt.Errorf("failed to list favorites: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Println("No favorites found")
			return nil
		}

		table := output.NewTable("ID", "TITLE", "TYPE", "CATEGORY", "STATUS", "AUTHOR")
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
			fmt.Printf("\nMore results available. Use --cursor %s to get next page.\n", resp.NextCursor)
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
			return fmt.Errorf("failed to toggle favorite: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := "unfavorited"
		if resp.Favorited {
			state = "favorited"
		}
		output.PrintSuccess("%s content %s (total: %d)", state, id, resp.FavoriteCount)
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
