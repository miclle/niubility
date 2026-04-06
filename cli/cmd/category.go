// Package cmd provides CLI commands
package cmd

import (
	"fmt"

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
	Use:     "category",
	Aliases: []string{"cat"},
	Short:   "Manage categories",
	Long:    `Manage content categories on Niubility platform.`,
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
			return wrapLocalizedError("Category.List.Error.ListFailed", "failed to list categories", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(categories)
		}

		if len(categories) == 0 {
			printLocalizedMessage("Category.List.Empty", "No categories found", nil)
			return nil
		}

		// Table output
		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Name", "NAME", nil),
			localizedText("Common.Label.Slug", "SLUG", nil),
			localizedText("Common.Label.Count", "COUNT", nil),
			localizedText("Common.Label.Visible", "VISIBLE", nil),
			localizedText("Common.Label.Sort", "SORT", nil),
		)
		for _, cat := range categories {
			visible := localizedYesNo(cat.Visible)
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
			return localizedError("Category.Create.Error.NameRequired", "--name is required")
		}
		if categoryCreateSlug == "" {
			return localizedError("Category.Create.Error.SlugRequired", "--slug is required")
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
			return wrapLocalizedError("Category.Create.Error.CreateFailed", "failed to create category", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(created)
		}

		output.PrintSuccessT("Category.Create.Success.Created", "Category created", nil)
		printLocalizedField("Common.Label.Identifier", "ID", created.ID)
		printLocalizedField("Common.Label.Name", "Name", created.Name)
		printLocalizedField("Common.Label.Slug", "Slug", created.Slug)
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
			return wrapLocalizedError("Category.Update.Error.UpdateFailed", "failed to update category", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccessT("Category.Update.Success.Updated", "Category updated", nil)
		printLocalizedField("Common.Label.Identifier", "ID", updated.ID)
		printLocalizedField("Common.Label.Name", "Name", updated.Name)
		printLocalizedField("Common.Label.Slug", "Slug", updated.Slug)
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
			if !confirmAction("Category.Delete.Prompt", "Are you sure you want to delete category {{.ID}}? [y/N]: ", map[string]interface{}{"ID": id}) {
				printLocalizedMessage("Common.Message.Cancelled", "Cancelled", nil)
				return nil
			}
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteCategory(ctx, id); err != nil {
			return wrapLocalizedError("Category.Delete.Error.DeleteFailed", "failed to delete category", err)
		}

		output.PrintSuccessT("Category.Delete.Success.Deleted", "Category {{.ID}} deleted", map[string]interface{}{"ID": id})
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

func localizeCategoryCommands() {
	categoryCmd.Short = localizedText("Category.Short", "Manage categories", nil)
	categoryCmd.Long = localizedText("Category.Long", "Manage content categories on Niubility platform.", nil)

	categoryListCmd.Short = localizedText("Category.List.Short", "List all categories", nil)
	categoryListCmd.Long = localizedText("Category.List.Long", "List all available content categories.", nil)

	categoryCreateCmd.Short = localizedText("Category.Create.Short", "Create a category (admin only)", nil)
	categoryCreateCmd.Long = localizedText("Category.Create.Long", "Create a new content category. Requires admin role.", nil)
	categoryCreateCmd.Example = localizedText("Category.Create.Example", categoryCreateCmd.Example, nil)

	categoryUpdateCmd.Short = localizedText("Category.Update.Short", "Update a category (admin only)", nil)
	categoryUpdateCmd.Long = localizedText("Category.Update.Long", "Update an existing content category. Only specified fields will be updated.", nil)
	categoryUpdateCmd.Example = localizedText("Category.Update.Example", categoryUpdateCmd.Example, nil)

	categoryDeleteCmd.Short = localizedText("Category.Delete.Short", "Delete a category (admin only)", nil)
	categoryDeleteCmd.Long = localizedText("Category.Delete.Long", "Delete a content category by ID. Requires admin role.", nil)

	if flag := categoryCreateCmd.Flags().Lookup("name"); flag != nil {
		flag.Usage = localizedText("Category.Flag.NameRequired", "Category name (required)", nil)
	}
	if flag := categoryCreateCmd.Flags().Lookup("slug"); flag != nil {
		flag.Usage = localizedText("Category.Flag.SlugRequired", "Category slug (required)", nil)
	}
	if flag := categoryCreateCmd.Flags().Lookup("icon"); flag != nil {
		flag.Usage = localizedText("Category.Flag.Icon", "Category icon", nil)
	}
	if flag := categoryCreateCmd.Flags().Lookup("sort-order"); flag != nil {
		flag.Usage = localizedText("Category.Flag.SortOrder", "Sort order", nil)
	}
	if flag := categoryUpdateCmd.Flags().Lookup("name"); flag != nil {
		flag.Usage = localizedText("Category.Flag.Name", "Category name", nil)
	}
	if flag := categoryUpdateCmd.Flags().Lookup("slug"); flag != nil {
		flag.Usage = localizedText("Category.Flag.Slug", "Category slug", nil)
	}
	if flag := categoryUpdateCmd.Flags().Lookup("icon"); flag != nil {
		flag.Usage = localizedText("Category.Flag.Icon", "Category icon", nil)
	}
	if flag := categoryUpdateCmd.Flags().Lookup("visible"); flag != nil {
		flag.Usage = localizedText("Category.Flag.Visible", "Visibility (true/false)", nil)
	}
	if flag := categoryUpdateCmd.Flags().Lookup("sort-order"); flag != nil {
		flag.Usage = localizedText("Category.Flag.SortOrder", "Sort order", nil)
	}
	if flag := categoryDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("Common.Flag.SkipConfirmation", "Skip confirmation", nil)
	}
}
