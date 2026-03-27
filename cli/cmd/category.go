// Package cmd provides CLI commands
package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

// categoryCmd represents the category command
var categoryCmd = &cobra.Command{
	Use:   "category",
	Short: "Manage categories",
	Long:  `Manage content categories on Niubility platform.`,
}

// categoryListCmd represents the category list command
var categoryListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List all categories",
	Long:    `List all available content categories.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		categories, err := apiClient.ListCategories(ctx)
		if err != nil {
			return fmt.Errorf("failed to list categories: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(categories)
		}

		if len(categories) == 0 {
			fmt.Println("No categories found")
			return nil
		}

		// Table output
		table := output.NewTable("ID", "NAME", "SLUG", "COUNT", "VISIBLE", "SORT")
		for _, cat := range categories {
			visible := "yes"
			if !cat.Visible {
				visible = "no"
			}
			table.AddRow(
				cat.ID,
				cat.Name,
				cat.Slug,
				fmt.Sprintf("%d", cat.ContentCount),
				visible,
				fmt.Sprintf("%d", cat.SortOrder),
			)
		}
		table.Print()

		return nil
	},
}

func init() {
	rootCmd.AddCommand(categoryCmd)
	categoryCmd.AddCommand(categoryListCmd)
}
