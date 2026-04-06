// Package cmd provides CLI commands
package cmd

import (
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// like flags
	likeTargetType string
	likeTargetID   string
)

// likeCmd represents the like command
var likeCmd = &cobra.Command{
	Use:   "like",
	Short: "Toggle like",
	Long:  `Toggle like on a content item, comment, or attachment.`,
	Example: `  # Like a content item
  niubility like --type content --id 123

  # Like a comment
  niubility like --type comment --id <comment-id>

  # Unlike (same command toggles)
  niubility like --type content --id 123`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if likeTargetType == "" {
			return localizedError("Like.Error.TypeRequired", "--type is required (content, comment, attachment)")
		}
		if likeTargetID == "" {
			return localizedError("Like.Error.TargetIDRequired", "--id is required")
		}

		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ToggleLike(ctx, likeTargetType, likeTargetID)
		if err != nil {
			return wrapLocalizedError("Like.Error.ToggleFailed", "failed to toggle like", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := localizedText("Like.State.Unliked", "unliked", nil)
		if resp.Liked {
			state = localizedText("Like.State.Liked", "liked", nil)
		}
		output.PrintSuccessT(
			"Like.Success",
			"{{.State}} {{.Type}} {{.ID}} (total: {{.Total}})",
			map[string]interface{}{"State": state, "Type": likeTargetType, "ID": likeTargetID, "Total": resp.LikeCount},
		)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(likeCmd)

	likeCmd.Flags().StringVarP(&likeTargetType, "type", "t", "", "Target type: content, comment, attachment")
	likeCmd.Flags().StringVarP(&likeTargetID, "id", "i", "", "Target ID")
}

func localizeLikeCommands() {
	likeCmd.Short = localizedText("Like.Short", "Toggle like", nil)
	likeCmd.Long = localizedText("Like.Long", "Toggle like on a content item, comment, or attachment.", nil)
	likeCmd.Example = localizedText("Like.Example", likeCmd.Example, nil)

	if flag := likeCmd.Flags().Lookup("type"); flag != nil {
		flag.Usage = localizedText("Like.Flag.Type", "Target type: content, comment, attachment", nil)
	}
	if flag := likeCmd.Flags().Lookup("id"); flag != nil {
		flag.Usage = localizedText("Like.Flag.TargetID", "Target ID", nil)
	}
}
