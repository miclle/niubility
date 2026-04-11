package cmd

import (
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var userDeleteYes bool

var userDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete a user",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		if !userDeleteYes {
			printLocalizedMessage("User.Delete.Prompt", "Delete user {{.ID}}? This cannot be undone. Use --yes to confirm.", map[string]interface{}{"ID": id})
			return nil
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteUser(ctx, id); err != nil {
			return wrapLocalizedError("User.Delete.Error.DeleteFailed", "failed to delete user", err)
		}

		output.PrintSuccessT("User.Delete.Success.Deleted", "deleted user {{.ID}}", map[string]interface{}{"ID": id})
		return nil
	},
}

func init() {
	userCmd.AddCommand(userDeleteCmd)

	userDeleteCmd.Flags().BoolVarP(&userDeleteYes, "yes", "y", false, "skip confirmation")
}

func localizeUserDeleteCommand() {
	userDeleteCmd.Short = localizedText("User.Delete.Short", "Delete a user", nil)

	if flag := userDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("User.Delete.Flag.Yes", "skip confirmation", nil)
	}
}
