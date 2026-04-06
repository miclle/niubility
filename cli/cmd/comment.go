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
			return localizedError("Comment.List.Error.ContentRequired", "--content is required")
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
			return wrapLocalizedError("Comment.List.Error.ListFailed", "failed to list comments", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("Comment.List.Empty", "No comments found", nil)
			return nil
		}

		fmt.Printf("%s\n\n", localizedText("Comment.List.Total", "Comments (total: {{.Count}})", map[string]interface{}{"Count": resp.Total}))
		printComments(resp.Items, 0)

		if resp.HasMore() {
			printPagination(resp.NextCursor)
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
			return localizedError("Comment.Create.Error.ContentRequired", "--content is required")
		}
		if commentCreateBody == "" {
			return localizedError("Comment.Create.Error.BodyRequired", "--body is required")
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
			return wrapLocalizedError("Comment.Create.Error.CreateFailed", "failed to create comment", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(comment)
		}

		output.PrintSuccessT("Comment.Create.Success.Created", "Comment created", nil)
		printLocalizedField("Common.Label.Identifier", "ID", comment.ID)
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
			if !confirmAction("Comment.Delete.Prompt", "Are you sure you want to delete comment {{.ID}}? [y/N]: ", map[string]interface{}{"ID": id}) {
				printLocalizedMessage("Common.Message.Cancelled", "Cancelled", nil)
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteComment(ctx, id); err != nil {
			return wrapLocalizedError("Comment.Delete.Error.DeleteFailed", "failed to delete comment", err)
		}

		output.PrintSuccessT("Comment.Delete.Success.Deleted", "Comment {{.ID}} deleted", map[string]interface{}{"ID": id})
		return nil
	},
}

// printComments recursively prints comments with indentation for replies
func printComments(comments []api.Comment, depth int) {
	indent := strings.Repeat("  ", depth)
	for _, c := range comments {
		author := localizedText("Common.Word.Unknown", "unknown", nil)
		if c.User != nil {
			author = c.User.Name
		}
		pinned := ""
		if c.PinnedAt != nil {
			pinned = localizedText("Comment.List.PinnedSuffix", " [pinned]", nil)
		}
		fmt.Printf("%s- %s (%s)%s: %s\n", indent, author, output.FormatTime(c.CreatedAt), pinned, output.Truncate(c.Body, 80))
		fmt.Printf(
			"%s  %s: %s | %s: %d\n",
			indent,
			localizedText("Common.Label.Identifier", "ID", nil),
			c.ID,
			localizedText("Common.Label.Likes", "Likes", nil),
			c.LikeCount,
		)
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

func localizeCommentCommands() {
	commentCmd.Short = localizedText("Comment.Short", "Manage comments", nil)
	commentCmd.Long = localizedText("Comment.Long", "Manage comments on content items.", nil)

	commentListCmd.Short = localizedText("Comment.List.Short", "List comments", nil)
	commentListCmd.Long = localizedText("Comment.List.Long", "List comments for a content item.", nil)
	commentListCmd.Example = localizedText("Comment.List.Example", commentListCmd.Example, nil)

	commentCreateCmd.Short = localizedText("Comment.Create.Short", "Create a comment", nil)
	commentCreateCmd.Long = localizedText("Comment.Create.Long", "Create a comment on a content item.", nil)
	commentCreateCmd.Example = localizedText("Comment.Create.Example", commentCreateCmd.Example, nil)

	commentDeleteCmd.Short = localizedText("Comment.Delete.Short", "Delete a comment", nil)
	commentDeleteCmd.Long = localizedText("Comment.Delete.Long", "Delete a comment by ID.", nil)

	if flag := commentListCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Limit", "Limit number of results", nil)
	}
	if flag := commentListCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("Common.Flag.Cursor", "Pagination cursor", nil)
	}
	if flag := commentListCmd.Flags().Lookup("content"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.ContentRequired", "Content ID (required)", nil)
	}
	if flag := commentCreateCmd.Flags().Lookup("content"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.ContentRequired", "Content ID (required)", nil)
	}
	if flag := commentCreateCmd.Flags().Lookup("attachment"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.Attachment", "Attachment ID", nil)
	}
	if flag := commentCreateCmd.Flags().Lookup("parent"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.Parent", "Parent comment ID (for replies)", nil)
	}
	if flag := commentCreateCmd.Flags().Lookup("reply-to"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.ReplyTo", "Reply target comment ID", nil)
	}
	if flag := commentCreateCmd.Flags().Lookup("body"); flag != nil {
		flag.Usage = localizedText("Comment.Flag.BodyRequired", "Comment body (required)", nil)
	}
	if flag := commentDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
}
