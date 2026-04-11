package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	userListLimit        int
	userListCursor       string
	userListSearch       string
	userListDepartmentID int64
)

var userListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List users",
	Long:    `List users with optional search and department filters.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ListUsers(ctx, &api.UserListOptions{
			Limit:        userListLimit,
			Cursor:       userListCursor,
			Search:       userListSearch,
			DepartmentID: userListDepartmentID,
		})
		if err != nil {
			return wrapLocalizedError("User.List.Error.ListFailed", "failed to list users", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("User.List.Empty", "No users found", nil)
			return nil
		}

		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Username", "USERNAME", nil),
			localizedText("Common.Label.Name", "NAME", nil),
			localizedText("Common.Label.Email", "EMAIL", nil),
			localizedText("Common.Label.Role", "ROLE", nil),
			localizedText("Common.Label.Status", "STATUS", nil),
			localizedText("Common.Label.Departments", "DEPARTMENTS", nil),
			localizedText("Common.Label.Created", "CREATED", nil),
		)
		for _, user := range resp.Items {
			table.AddRow(
				user.ID,
				user.Username,
				output.Truncate(user.Name, 20),
				output.Truncate(user.Email, 28),
				user.Role,
				user.Status,
				output.Truncate(user.DepartmentIDs, 18),
				output.FormatTime(user.CreatedAt),
			)
		}
		table.Print()

		if resp.Total != nil {
			printTotal(*resp.Total)
		}
		if resp.HasMore() {
			fmt.Print(localizedText("Common.Message.MoreResults", "More results available. Use --cursor {{.Cursor}} to get next page.", map[string]interface{}{"Cursor": resp.NextCursor}))
			fmt.Println()
		}

		return nil
	},
}

func init() {
	userCmd.AddCommand(userListCmd)

	userListCmd.Flags().IntVarP(&userListLimit, "limit", "n", 20, "maximum number of users to return")
	userListCmd.Flags().StringVar(&userListCursor, "cursor", "", "cursor for next page")
	userListCmd.Flags().StringVar(&userListSearch, "search", "", "search by name, username, email, or mobile")
	userListCmd.Flags().Int64Var(&userListDepartmentID, "department-id", 0, "filter by department ID")
}

func localizeUserListCommand() {
	userListCmd.Short = localizedText("User.List.Short", "List users", nil)
	userListCmd.Long = localizedText("User.List.Long", "List users with optional search and department filters.", nil)

	if flag := userListCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("User.Flag.ListLimit", "maximum number of users to return", nil)
	}
	if flag := userListCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("User.Flag.ListCursor", "cursor for next page", nil)
	}
	if flag := userListCmd.Flags().Lookup("search"); flag != nil {
		flag.Usage = localizedText("User.Flag.Search", "search by name, username, email, or mobile", nil)
	}
	if flag := userListCmd.Flags().Lookup("department-id"); flag != nil {
		flag.Usage = localizedText("User.Flag.DepartmentID", "filter by department ID", nil)
	}
}
