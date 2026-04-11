package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var userViewCmd = &cobra.Command{
	Use:     "view <id>",
	Aliases: []string{"get"},
	Short:   "View user details",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		user, err := apiClient.GetUser(ctx, args[0])
		if err != nil {
			return wrapLocalizedError("User.View.Error.GetFailed", "failed to get user", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		printLocalizedField("Common.Label.Identifier", "ID", user.ID)
		printLocalizedField("Common.Label.Username", "Username", user.Username)
		printLocalizedField("Common.Label.Name", "Name", user.Name)
		printLocalizedField("Common.Label.Email", "Email", user.Email)
		printLocalizedField("Common.Label.Role", "Role", user.Role)
		printLocalizedField("Common.Label.Status", "Status", user.Status)
		if user.Mobile != "" {
			printLocalizedField("Common.Label.Mobile", "Mobile", user.Mobile)
		}
		if user.Location != "" {
			printLocalizedField("Common.Label.Location", "Location", user.Location)
		}
		if user.DepartmentIDs != "" {
			printLocalizedField("Common.Label.DepartmentIDs", "Department IDs", user.DepartmentIDs)
		}
		if user.Avatar != "" {
			printLocalizedField("Common.Label.Avatar", "Avatar", user.Avatar)
		}
		if user.Bio != "" {
			printLocalizedField("Common.Label.Bio", "Bio", user.Bio)
		}
		if len(user.SocialAccounts) > 0 {
			printLocalizedMessage("Common.Label.SocialAccounts", "Social Accounts:", nil)
			for key, value := range user.SocialAccounts {
				fmt.Printf("  %s=%s\n", key, value)
			}
		}
		printLocalizedField("Common.Label.Followers", "Followers", fmt.Sprintf("%d", user.FollowerCount))
		printLocalizedField("Common.Label.Following", "Following", fmt.Sprintf("%d", user.FollowingCount))
		printLocalizedField("Common.Label.Created", "Created", output.FormatTime(user.CreatedAt))
		printLocalizedField("Common.Label.Updated", "Updated", output.FormatTime(user.UpdatedAt))

		return nil
	},
}

func init() {
	userCmd.AddCommand(userViewCmd)
}

func localizeUserViewCommand() {
	userViewCmd.Short = localizedText("User.View.Short", "View user details", nil)
}
