// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/spf13/cobra"
)

var userCmd = &cobra.Command{
	Use:     "user",
	Aliases: []string{"usr"},
	Short:   "Manage users",
	Long:    `Manage users on Niubility platform. Most subcommands require admin permission.`,
}

func init() {
	rootCmd.AddCommand(userCmd)
}

// optionalStringFlag returns a pointer to the flag value if the flag was explicitly set, nil otherwise.
func optionalStringFlag(cmd *cobra.Command, name, value string) *string {
	if !cmd.Flags().Changed(name) {
		return nil
	}
	v := value
	return &v
}

// parseSocialAccounts parses key=value social account pairs from flag values.
func parseSocialAccounts(items []string) (map[string]string, error) {
	if len(items) == 0 {
		return nil, nil
	}
	socialAccounts := make(map[string]string, len(items))
	for _, item := range items {
		key, value, ok := strings.Cut(item, "=")
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if !ok || key == "" {
			return nil, fmt.Errorf("%s", localizedText("User.Error.InvalidSocial", "invalid --social value {{.Value}}, expected key=value", map[string]interface{}{"Value": fmt.Sprintf("%q", item)}))
		}
		socialAccounts[key] = value
	}
	return socialAccounts, nil
}

// isEmptyUpdateRequest checks whether the update request has any fields set.
func isEmptyUpdateRequest(req *api.UpdateUserRequest) bool {
	return req.Username == nil &&
		req.Email == nil &&
		req.Password == nil &&
		req.Name == nil &&
		req.Mobile == nil &&
		req.Avatar == nil &&
		req.Bio == nil &&
		req.Location == nil &&
		req.DepartmentIDs == nil &&
		req.Role == nil &&
		req.Status == nil &&
		req.CreatedAt == nil &&
		req.UpdatedAt == nil &&
		req.SocialAccounts == nil
}

// localizeUserCommands localizes all user subcommands.
func localizeUserCommands() {
	userCmd.Short = localizedText("User.Short", "Manage users", nil)
	userCmd.Long = localizedText("User.Long", "Manage users on Niubility platform. Most subcommands require admin permission.", nil)

	localizeUserListCommand()
	localizeUserViewCommand()
	localizeUserCreateCommand()
	localizeUserUpdateCommand()
	localizeUserDeleteCommand()
}
