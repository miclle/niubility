// Package cmd provides CLI commands
package cmd

import (
	"fmt"

	"github.com/miclle/niubility-cli/internal/output"
	"github.com/spf13/cobra"
)

// whoamiCmd represents the whoami command
var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show current logged in user",
	Long: `Show information about the currently logged in user.

This command calls the boot endpoint to verify authentication status
and display user information.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Get boot info
		ctx, cancel := getContext()
		defer cancel()

		boot, err := apiClient.Boot(ctx)
		if err != nil {
			return fmt.Errorf("failed to get boot info: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(map[string]interface{}{
				"initialized":    boot.Initialized,
				"authenticated":  boot.IsAuthenticated(),
				"user":           boot.User,
				"allow_register": boot.AllowRegister,
				"enable_sso":     boot.EnableSSO,
			})
		}

		// Table output
		if !boot.IsAuthenticated() || boot.User == nil {
			fmt.Println("Not logged in")
			return nil
		}

		fmt.Printf("Logged in as: %s\n", boot.User.Name)
		fmt.Printf("Username: %s\n", boot.User.Username)
		fmt.Printf("Email: %s\n", boot.User.Email)
		fmt.Printf("Role: %s\n", boot.User.Role)
		if boot.User.Location != "" {
			fmt.Printf("Location: %s\n", boot.User.Location)
		}
		fmt.Printf("Server: %s\n", cfg.Server)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(whoamiCmd)
}
