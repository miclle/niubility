// Package cmd provides CLI commands
package cmd

import (
	"github.com/miclle/niubility/cli/internal/config"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
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
			output.PrintInfoT("Common.Status.NotLoggedIn", "Not logged in", nil)
			return nil
		}

		// Optionally call server logout
		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.Logout(ctx); err != nil {
			// Log error but don't fail - we still want to clear local session
			output.PrintError("%s: %v", clii18n.T("Logout.Error.ServerLogoutFailed", "server logout failed", nil), err)
		}

		// Clear local session
		if err := authMgr.Clear(); err != nil {
			return wrapLocalizedError("Logout.Error.FailedClearSession", "failed to clear session", err)
		}
		if cfg != nil {
			cfg.Token = ""
			if err := config.SaveProfile(profileName, cfg, cfgFile); err != nil {
				output.PrintError("%s: %v", clii18n.T("Logout.Error.FailedSaveConfig", "failed to save config", nil), err)
			}
		}

		output.PrintSuccessT("Logout.Success.LoggedOut", "Logged out", nil)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
