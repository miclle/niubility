// Package cmd provides CLI commands
package cmd

import (
	"github.com/miclle/niubility/cli/internal/output"
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
			return wrapLocalizedError("WhoAmI.Error.FailedGetBootInfo", "failed to get boot info", err)
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
			output.PrintInfoT("Common.Status.NotLoggedIn", "Not logged in", nil)
			return nil
		}

		printLocalizedField("WhoAmI.Output.LoggedInAs", "Logged in as", boot.User.Name)
		printLocalizedField("Common.Label.Username", "Username", boot.User.Username)
		printLocalizedField("Common.Label.Email", "Email", boot.User.Email)
		printLocalizedField("Common.Label.Role", "Role", boot.User.Role)
		if profileName != "" {
			printLocalizedField("Common.Label.Profile", "Profile", profileName)
		}
		if boot.User.Location != "" {
			printLocalizedField("Common.Label.Location", "Location", boot.User.Location)
		}
		printLocalizedField("Common.Label.Server", "Server", cfg.Server)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(whoamiCmd)
}
