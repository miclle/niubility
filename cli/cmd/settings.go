// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	// settings update flags
	settingsSetValues []string
)

// settingsCmd represents the settings command
var settingsCmd = &cobra.Command{
	Use:   "settings",
	Short: "Manage system settings (admin only)",
	Long:  `View and update system settings. Requires admin role.`,
}

// settingsListCmd represents the settings list command
var settingsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all settings",
	Long:  `List all system settings. Sensitive values are masked.`,
	Example: `  # List all settings
  niubility settings list

  # JSON output
  niubility settings list --output json`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		settings, err := apiClient.ListSettings(ctx)
		if err != nil {
			return fmt.Errorf("failed to list settings: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(settings)
		}

		if len(settings) == 0 {
			fmt.Println("No settings found")
			return nil
		}

		table := output.NewTable("KEY", "VALUE", "UPDATED")
		for _, s := range settings {
			value := s.Value
			// Mask long/sensitive values in table output
			if len(value) > 60 {
				value = value[:57] + "..."
			}
			table.AddRow(s.Key, value, output.FormatTime(s.UpdatedAt))
		}
		table.Print()

		return nil
	},
}

// settingsSetCmd represents the settings set command
var settingsSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Update settings",
	Long:  `Update one or more settings. Provide key=value pairs.`,
	Example: `  # Update site name
  niubility settings set site.name="My Platform"

  # Update multiple settings
  niubility settings set site.name="My Platform" registration.enabled=true`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if len(settingsSetValues) == 0 {
			return fmt.Errorf("at least one key=value pair is required")
		}

		settings := make(map[string]string)
		for _, kv := range settingsSetValues {
			parts := strings.SplitN(kv, "=", 2)
			if len(parts) != 2 {
				return fmt.Errorf("invalid format: %s (expected key=value)", kv)
			}
			settings[parts[0]] = parts[1]
		}

		ctx, cancel := getContext()
		defer cancel()

		updated, err := apiClient.UpdateSettings(ctx, settings)
		if err != nil {
			return fmt.Errorf("failed to update settings: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccess("Settings updated")
		for _, s := range updated {
			if _, ok := settings[s.Key]; ok {
				value := s.Value
				if len(value) > 60 {
					value = value[:57] + "..."
				}
				fmt.Printf("  %s = %s\n", s.Key, value)
			}
		}
		return nil
	},
}

func init() {
	rootCmd.AddCommand(settingsCmd)
	settingsCmd.AddCommand(settingsListCmd)
	settingsCmd.AddCommand(settingsSetCmd)

	// settings set flags
	settingsSetCmd.Flags().StringArrayVar(&settingsSetValues, "set", nil, "Setting key=value pair")
}
