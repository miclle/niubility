// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// comment list flags
	commentListLimit     int
	commentListCursor    string
	commentListContentID string

	// comment create flags
	commentCreateContentID    string
	commentCreateAttachmentID string
	commentCreateParentID     string
	commentCreateReplyToID    string
	commentCreateBody         string

	// comment delete flags
	commentDeleteYes bool
)

// commentCmd represents the comment command
var commentCmd = &cobra.Command{
	Use:     "comment",
	Aliases: []string{"cmt"},
	Short:   "Manage comments",
	Long:    `Manage comments on content items.`,
}

// commentListCmd represents the comment list command
var commentListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List comments",
	Long:    `List comments for a content item.`,
	Example: `  # List comments for a content item
  niubility comment list --content 123

  # List comments with pagination
  niubility comment list --content 123 --limit 10`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if commentListContentID == "" {
			return fmt.Errorf("--content is required")
		}

		ctx, cancel := getContext()
		defer cancel()

		opts := &api.CommentListOptions{
			Limit:     commentListLimit,
			Cursor:    commentListCursor,
			ContentID: commentListContentID,
		}

		resp, err := apiClient.ListComments(ctx, opts)
		if err != nil {
			return fmt.Errorf("failed to list comments: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Println("No comments found")
			return nil
		}

		fmt.Printf("Comments (total: %d)\n\n", resp.Total)
		printComments(resp.Items, 0)

		if resp.HasMore() {
			fmt.Printf("\nMore results available. Use --cursor %s to get next page.\n", resp.NextCursor)
		}

		return nil
	},
}

// commentCreateCmd represents the comment create command
var commentCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a comment",
	Long:  `Create a comment on a content item.`,
	Example: `  # Create a comment
  niubility comment create --content 123 --body "Great article!"

  # Reply to a comment
  niubility comment create --content 123 --parent <comment-id> --body "Thanks!"`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if commentCreateContentID == "" {
			return fmt.Errorf("--content is required")
		}
		if commentCreateBody == "" {
			return fmt.Errorf("--body is required")
		}

		ctx, cancel := getContext()
		defer cancel()

		req := &api.CreateCommentRequest{
			ContentID:    commentCreateContentID,
			AttachmentID: commentCreateAttachmentID,
			ParentID:     commentCreateParentID,
			ReplyToID:    commentCreateReplyToID,
			Body:         commentCreateBody,
		}

		comment, err := apiClient.CreateComment(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to create comment: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(comment)
		}

		output.PrintSuccess("Comment created")
		fmt.Printf("ID: %s\n", comment.ID)
		return nil
	},
}

// commentDeleteCmd represents the comment delete command
var commentDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete a comment",
	Long:    `Delete a comment by ID.`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		if !commentDeleteYes {
			fmt.Printf("Are you sure you want to delete comment %s? [y/N]: ", id)
			var response string
			if _, err := fmt.Scanln(&response); err != nil {
				response = ""
			}
			if strings.ToLower(response) != "y" && strings.ToLower(response) != "yes" {
				fmt.Println("Cancelled")
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteComment(ctx, id); err != nil {
			return fmt.Errorf("failed to delete comment: %w", err)
		}

		output.PrintSuccess("Comment %s deleted", id)
		return nil
	},
}

// printComments recursively prints comments with indentation for replies
func printComments(comments []api.Comment, depth int) {
	indent := strings.Repeat("  ", depth)
	for _, c := range comments {
		author := "unknown"
		if c.User != nil {
			author = c.User.Name
		}
		pinned := ""
		if c.PinnedAt != nil {
			pinned = " [pinned]"
		}
		fmt.Printf("%s- %s (%s)%s: %s\n", indent, author, output.FormatTime(c.CreatedAt), pinned, output.Truncate(c.Body, 80))
		fmt.Printf("%s  ID: %s | Likes: %d\n", indent, c.ID, c.LikeCount)
		if len(c.Replies) > 0 {
			printComments(c.Replies, depth+1)
		}
	}
}

func init() {
	rootCmd.AddCommand(commentCmd)
	commentCmd.AddCommand(commentListCmd)
	commentCmd.AddCommand(commentCreateCmd)
	commentCmd.AddCommand(commentDeleteCmd)

	// comment list flags
	commentListCmd.Flags().IntVarP(&commentListLimit, "limit", "l", 20, "Limit number of results")
	commentListCmd.Flags().StringVar(&commentListCursor, "cursor", "", "Pagination cursor")
	commentListCmd.Flags().StringVarP(&commentListContentID, "content", "c", "", "Content ID (required)")

	// comment create flags
	commentCreateCmd.Flags().StringVarP(&commentCreateContentID, "content", "c", "", "Content ID (required)")
	commentCreateCmd.Flags().StringVar(&commentCreateAttachmentID, "attachment", "", "Attachment ID")
	commentCreateCmd.Flags().StringVar(&commentCreateParentID, "parent", "", "Parent comment ID (for replies)")
	commentCreateCmd.Flags().StringVar(&commentCreateReplyToID, "reply-to", "", "Reply target comment ID")
	commentCreateCmd.Flags().StringVarP(&commentCreateBody, "body", "b", "", "Comment body (required)")

	// comment delete flags
	commentDeleteCmd.Flags().BoolVarP(&commentDeleteYes, "yes", "y", false, "Skip confirmation")
}
