// Package cmd provides CLI commands
package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/config"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

// logoutCmd represents the logout command
var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout from Niubility server",
	Long: `Logout from Niubility server and clear local session.

This command clears the local session and optionally calls
the server logout endpoint to invalidate the server-side session.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Check if we have a session
		if authMgr == nil || !authMgr.HasSession() {
			fmt.Println("Not logged in")
			return nil
		}

		// Optionally call server logout
		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.Logout(ctx); err != nil {
			// Log error but don't fail - we still want to clear local session
			output.PrintError("server logout failed: %v", err)
		}

		// Clear local session
		if err := authMgr.Clear(); err != nil {
			return fmt.Errorf("failed to clear session: %w", err)
		}
		if cfg != nil {
			cfg.Token = ""
			if err := config.SaveProfile(profileName, cfg, cfgFile); err != nil {
				output.PrintError("failed to save config: %v", err)
			}
		}

		output.PrintSuccess("Logged out")
		return nil
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
