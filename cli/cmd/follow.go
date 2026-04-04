// Package cmd provides CLI commands
package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// follow list flags
	followListLimit  int
	followListCursor string
)

// followCmd represents the follow command
var followCmd = &cobra.Command{
	Use:   "follow",
	Short: "Manage follows",
	Long:  `Manage user follow relationships.`,
}

// followToggleCmd represents the follow toggle command
var followToggleCmd = &cobra.Command{
	Use:   "toggle <username>",
	Short: "Toggle follow on a user",
	Long:  `Toggle follow on a user. Same command to follow or unfollow.`,
	Args:  cobra.ExactArgs(1),
	Example: `  # Follow a user
  niubility follow toggle alice

  # Unfollow (same command toggles)
  niubility follow toggle alice`,
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]

		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ToggleFollow(ctx, username)
		if err != nil {
			return fmt.Errorf("failed to toggle follow: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := "unfollowed"
		if resp.Following {
			state = "followed"
		}
		output.PrintSuccess("%s %s (followers: %d, following: %d)", state, username, resp.FollowerCount, resp.FollowingCount)
		return nil
	},
}

// followListCmd represents the follow list command (following)
var followListFollowingCmd = &cobra.Command{
	Use:   "following <username>",
	Short: "List users that a user is following",
	Args:  cobra.ExactArgs(1),
	Example: `  # List users that alice is following
  niubility follow following alice`,
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]

		ctx, cancel := getContext()
		defer cancel()

		opts := &api.PaginationOptions{
			Limit:  followListLimit,
			Cursor: followListCursor,
		}

		resp, err := apiClient.ListFollowing(ctx, username, opts)
		if err != nil {
			return fmt.Errorf("failed to list following: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Printf("%s is not following anyone\n", username)
			return nil
		}

		table := output.NewTable("ID", "USERNAME", "NAME", "ROLE")
		for _, u := range resp.Items {
			table.AddRow(u.ID, u.Username, u.Name, u.Role)
		}
		table.Print()

		if resp.HasMore() {
			fmt.Printf("\nMore results available. Use --cursor %s to get next page.\n", resp.NextCursor)
		}

		return nil
	},
}

// followListFollowersCmd represents the followers list command
var followListFollowersCmd = &cobra.Command{
	Use:   "followers <username>",
	Short: "List followers of a user",
	Args:  cobra.ExactArgs(1),
	Example: `  # List followers of alice
  niubility follow followers alice`,
	RunE: func(cmd *cobra.Command, args []string) error {
		username := args[0]

		ctx, cancel := getContext()
		defer cancel()

		opts := &api.PaginationOptions{
			Limit:  followListLimit,
			Cursor: followListCursor,
		}

		resp, err := apiClient.ListFollowers(ctx, username, opts)
		if err != nil {
			return fmt.Errorf("failed to list followers: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Printf("%s has no followers\n", username)
			return nil
		}

		table := output.NewTable("ID", "USERNAME", "NAME", "ROLE")
		for _, u := range resp.Items {
			table.AddRow(u.ID, u.Username, u.Name, u.Role)
		}
		table.Print()

		if resp.HasMore() {
			fmt.Printf("\nMore results available. Use --cursor %s to get next page.\n", resp.NextCursor)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(followCmd)
	followCmd.AddCommand(followToggleCmd)
	followCmd.AddCommand(followListFollowingCmd)
	followCmd.AddCommand(followListFollowersCmd)

	followListFollowingCmd.Flags().IntVarP(&followListLimit, "limit", "l", 20, "Limit number of results")
	followListFollowingCmd.Flags().StringVar(&followListCursor, "cursor", "", "Pagination cursor")
	followListFollowersCmd.Flags().IntVarP(&followListLimit, "limit", "l", 20, "Limit number of results")
	followListFollowersCmd.Flags().StringVar(&followListCursor, "cursor", "", "Pagination cursor")
}
