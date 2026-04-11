// Package cmd provides CLI commands
package cmd

import (
	"github.com/spf13/cobra"
)

// contentCmd represents the content command
var contentCmd = &cobra.Command{
	Use:     "content",
	Aliases: []string{"cnt"},
	Short:   "Manage content",
	Long: `Manage content on Niubility platform.

Content types: article, gallery, video
Status: draft, published`,
}

func init() {
	rootCmd.AddCommand(contentCmd)
}

// localizeContentCommands localizes all content subcommands.
func localizeContentCommands() {
	contentCmd.Short = localizedText("Content.Short", "Manage content", nil)
	contentCmd.Long = localizedText("Content.Long", contentCmd.Long, nil)

	localizeContentListCommand()
	localizeContentViewCommand()
	localizeContentCreateCommand()
	localizeContentEditCommand()
	localizeContentDeleteCommand()
}
