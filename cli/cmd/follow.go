// Package cmd provides CLI commands
package cmd

import (
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
			return wrapLocalizedError("Follow.Toggle.Error.ToggleFailed", "failed to toggle follow", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := localizedText("Follow.Toggle.State.Unfollowed", "unfollowed", nil)
		if resp.Following {
			state = localizedText("Follow.Toggle.State.Followed", "followed", nil)
		}
		output.PrintSuccessT(
			"Follow.Toggle.Success",
			"{{.State}} {{.Username}} (followers: {{.Followers}}, following: {{.Following}})",
			map[string]interface{}{
				"State":     state,
				"Username":  username,
				"Followers": resp.FollowerCount,
				"Following": resp.FollowingCount,
			},
		)
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
			return wrapLocalizedError("Follow.Following.Error.ListFailed", "failed to list following", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("Follow.Following.Empty", "{{.Username}} is not following anyone", map[string]interface{}{"Username": username})
			return nil
		}

		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Username", "USERNAME", nil),
			localizedText("Common.Label.Name", "NAME", nil),
			localizedText("Common.Label.Role", "ROLE", nil),
		)
		for _, u := range resp.Items {
			table.AddRow(u.ID, u.Username, u.Name, u.Role)
		}
		table.Print()

		if resp.HasMore() {
			printPagination(resp.NextCursor)
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
			return wrapLocalizedError("Follow.Followers.Error.ListFailed", "failed to list followers", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("Follow.Followers.Empty", "{{.Username}} has no followers", map[string]interface{}{"Username": username})
			return nil
		}

		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Username", "USERNAME", nil),
			localizedText("Common.Label.Name", "NAME", nil),
			localizedText("Common.Label.Role", "ROLE", nil),
		)
		for _, u := range resp.Items {
			table.AddRow(u.ID, u.Username, u.Name, u.Role)
		}
		table.Print()

		if resp.HasMore() {
			printPagination(resp.NextCursor)
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

func localizeFollowCommands() {
	followCmd.Short = localizedText("Follow.Short", "Manage follows", nil)
	followCmd.Long = localizedText("Follow.Long", "Manage user follow relationships.", nil)

	followToggleCmd.Short = localizedText("Follow.Toggle.Short", "Toggle follow on a user", nil)
	followToggleCmd.Long = localizedText("Follow.Toggle.Long", "Toggle follow on a user. Same command to follow or unfollow.", nil)
	followToggleCmd.Example = localizedText("Follow.Toggle.Example", followToggleCmd.Example, nil)

	followListFollowingCmd.Short = localizedText("Follow.Following.Short", "List users that a user is following", nil)
	followListFollowingCmd.Example = localizedText("Follow.Following.Example", followListFollowingCmd.Example, nil)

	followListFollowersCmd.Short = localizedText("Follow.Followers.Short", "List followers of a user", nil)
	followListFollowersCmd.Example = localizedText("Follow.Followers.Example", followListFollowersCmd.Example, nil)

	if flag := followListFollowingCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Limit", "Limit number of results", nil)
	}
	if flag := followListFollowingCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Cursor", "Pagination cursor", nil)
	}
	if flag := followListFollowersCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Limit", "Limit number of results", nil)
	}
	if flag := followListFollowersCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Cursor", "Pagination cursor", nil)
	}
}
