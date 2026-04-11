package cmd

import (
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var contentDeleteYes bool

// contentDeleteCmd represents the content delete command
var contentDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete content",
	Long:    `Delete a content item by ID.`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		// Confirm deletion
		if !contentDeleteYes {
			ctx, cancel := getContext()
			c, err := apiClient.GetContent(ctx, id)
			cancel()
			if err != nil {
				return wrapLocalizedError("Content.Delete.Error.GetFailed", "failed to get content", err)
			}

			if !confirmAction("Content.Delete.Prompt", "Are you sure you want to delete '{{.Title}}'? [y/N]: ", map[string]interface{}{"Title": c.Title}) {
				printLocalizedMessage("Common.Message.Cancelled", "Cancelled", nil)
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteContent(ctx, id); err != nil {
			return wrapLocalizedError("Content.Delete.Error.DeleteFailed", "failed to delete content", err)
		}

		output.PrintSuccessT("Content.Delete.Success.Deleted", "Content {{.ID}} deleted", map[string]interface{}{"ID": id})
		return nil
	},
}

func init() {
	contentCmd.AddCommand(contentDeleteCmd)

	contentDeleteCmd.Flags().BoolVarP(&contentDeleteYes, "yes", "y", false, "Skip confirmation")
}

func localizeContentDeleteCommand() {
	contentDeleteCmd.Short = localizedText("Content.Delete.Short", "Delete content", nil)
	contentDeleteCmd.Long = localizedText("Content.Delete.Long", "Delete a content item by ID.", nil)

	if flag := contentDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
}
