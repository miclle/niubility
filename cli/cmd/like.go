// Package cmd provides CLI commands
package cmd

import (
	"fmt"

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
			return fmt.Errorf("--type is required (content, comment, attachment)")
		}
		if likeTargetID == "" {
			return fmt.Errorf("--id is required")
		}

		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ToggleLike(ctx, likeTargetType, likeTargetID)
		if err != nil {
			return fmt.Errorf("failed to toggle like: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		state := "unliked"
		if resp.Liked {
			state = "liked"
		}
		output.PrintSuccess("%s %s %s (total: %d)", state, likeTargetType, likeTargetID, resp.LikeCount)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(likeCmd)

	likeCmd.Flags().StringVarP(&likeTargetType, "type", "t", "", "Target type: content, comment, attachment")
	likeCmd.Flags().StringVarP(&likeTargetID, "id", "i", "", "Target ID")
}
