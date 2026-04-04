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
	// category create flags
	categoryCreateName      string
	categoryCreateSlug      string
	categoryCreateIcon      string
	categoryCreateSortOrder int

	// category update flags
	categoryUpdateName      string
	categoryUpdateSlug      string
	categoryUpdateIcon      string
	categoryUpdateVisible   string
	categoryUpdateSortOrder int

	// category delete flags
	categoryDeleteYes bool
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

// categoryCreateCmd represents the category create command
var categoryCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a category (admin only)",
	Long:  `Create a new content category. Requires admin role.`,
	Example: `  # Create a category
  niubility category create --name "Learning" --slug learning

  # Create with icon and sort order
  niubility category create --name "Talks" --slug talks --icon microphone --sort-order 1`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if categoryCreateName == "" {
			return fmt.Errorf("--name is required")
		}
		if categoryCreateSlug == "" {
			return fmt.Errorf("--slug is required")
		}

		ctx, cancel := getContext()
		defer cancel()

		req := &api.CreateCategoryRequest{
			Name:      categoryCreateName,
			Slug:      categoryCreateSlug,
			Icon:      categoryCreateIcon,
			SortOrder: categoryCreateSortOrder,
		}

		created, err := apiClient.CreateCategory(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to create category: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(created)
		}

		output.PrintSuccess("Category created")
		fmt.Printf("ID: %s\n", created.ID)
		fmt.Printf("Name: %s\n", created.Name)
		fmt.Printf("Slug: %s\n", created.Slug)
		return nil
	},
}

// categoryUpdateCmd represents the category update command
var categoryUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a category (admin only)",
	Long:  `Update an existing content category. Only specified fields will be updated.`,
	Example: `  # Update category name
  niubility category update <id> --name "New Name"

  # Hide a category
  niubility category update <id> --visible false

  # Update sort order
  niubility category update <id> --sort-order 5`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		ctx, cancel := getContext()
		defer cancel()

		req := &api.UpdateCategoryRequest{}
		if categoryUpdateName != "" {
			req.Name = &categoryUpdateName
		}
		if categoryUpdateSlug != "" {
			req.Slug = &categoryUpdateSlug
		}
		if categoryUpdateIcon != "" {
			req.Icon = &categoryUpdateIcon
		}
		if categoryUpdateVisible != "" {
			v := categoryUpdateVisible == "true" || categoryUpdateVisible == "yes" || categoryUpdateVisible == "1"
			req.Visible = &v
		}
		if cmd.Flags().Changed("sort-order") {
			req.SortOrder = &categoryUpdateSortOrder
		}

		updated, err := apiClient.UpdateCategory(ctx, id, req)
		if err != nil {
			return fmt.Errorf("failed to update category: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccess("Category updated")
		fmt.Printf("ID: %s\n", updated.ID)
		fmt.Printf("Name: %s\n", updated.Name)
		fmt.Printf("Slug: %s\n", updated.Slug)
		return nil
	},
}

// categoryDeleteCmd represents the category delete command
var categoryDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete a category (admin only)",
	Long:    `Delete a content category by ID. Requires admin role.`,
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]

		if !categoryDeleteYes {
			fmt.Printf("Are you sure you want to delete category %s? [y/N]: ", id)
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

		if err := apiClient.DeleteCategory(ctx, id); err != nil {
			return fmt.Errorf("failed to delete category: %w", err)
		}

		output.PrintSuccess("Category %s deleted", id)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(categoryCmd)
	categoryCmd.AddCommand(categoryListCmd)
	categoryCmd.AddCommand(categoryCreateCmd)
	categoryCmd.AddCommand(categoryUpdateCmd)
	categoryCmd.AddCommand(categoryDeleteCmd)

	// category create flags
	categoryCreateCmd.Flags().StringVar(&categoryCreateName, "name", "", "Category name (required)")
	categoryCreateCmd.Flags().StringVar(&categoryCreateSlug, "slug", "", "Category slug (required)")
	categoryCreateCmd.Flags().StringVar(&categoryCreateIcon, "icon", "", "Category icon")
	categoryCreateCmd.Flags().IntVar(&categoryCreateSortOrder, "sort-order", 0, "Sort order")

	// category update flags
	categoryUpdateCmd.Flags().StringVar(&categoryUpdateName, "name", "", "Category name")
	categoryUpdateCmd.Flags().StringVar(&categoryUpdateSlug, "slug", "", "Category slug")
	categoryUpdateCmd.Flags().StringVar(&categoryUpdateIcon, "icon", "", "Category icon")
	categoryUpdateCmd.Flags().StringVar(&categoryUpdateVisible, "visible", "", "Visibility (true/false)")
	categoryUpdateCmd.Flags().IntVar(&categoryUpdateSortOrder, "sort-order", 0, "Sort order")

	// category delete flags
	categoryDeleteCmd.Flags().BoolVarP(&categoryDeleteYes, "yes", "y", false, "Skip confirmation")
}
