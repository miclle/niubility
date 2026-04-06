// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var (
	// profile update flags
	profileUpdateName           string
	profileUpdateBio            string
	profileUpdateLocation       string
	profileUpdateAvatar         string
	profileUpdateSocialAccounts []string

	// profile password flags
	profileOldPassword string
	profileNewPassword string
)

// profileCmd represents the profile command
var profileCmd = &cobra.Command{
	Use:   "profile",
	Short: "Manage your profile",
	Long:  `View and update your profile, change password.`,
}

// profileViewCmd represents the profile view command
var profileViewCmd = &cobra.Command{
	Use:   "view",
	Short: "View your profile",
	Long:  `View your current profile information.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		user, err := apiClient.GetProfile(ctx)
		if err != nil {
			return wrapLocalizedError("Profile.View.Error.GetFailed", "failed to get profile", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		printLocalizedField("Common.Label.Identifier", "ID", user.ID)
		printLocalizedField("Common.Label.Username", "Username", user.Username)
		printLocalizedField("Common.Label.Name", "Name", user.Name)
		printLocalizedField("Common.Label.Email", "Email", user.Email)
		if user.Mobile != "" {
			printLocalizedField("Common.Label.Mobile", "Mobile", user.Mobile)
		}
		if user.Bio != "" {
			printLocalizedField("Common.Label.Bio", "Bio", user.Bio)
		}
		if user.Location != "" {
			printLocalizedField("Common.Label.Location", "Location", user.Location)
		}
		printLocalizedField("Common.Label.Role", "Role", user.Role)
		printLocalizedField("Common.Label.Status", "Status", user.Status)
		fmt.Printf(
			"%s: %d | %s: %d\n",
			localizedText("Common.Label.Followers", "Followers", nil),
			user.FollowerCount,
			localizedText("Common.Label.Following", "Following", nil),
			user.FollowingCount,
		)
		if len(user.SocialAccounts) > 0 {
			fmt.Printf("%s: ", localizedText("Common.Label.Social", "Social", nil))
			var parts []string
			for k, v := range user.SocialAccounts {
				parts = append(parts, fmt.Sprintf("%s=%s", k, v))
			}
			fmt.Printf("%s\n", strings.Join(parts, ", "))
		}

		return nil
	},
}

// profileUpdateCmd represents the profile update command
var profileUpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update your profile",
	Long:  `Update your profile fields. Only specified fields will be changed.`,
	Example: `  # Update name
  niubility profile update --name "New Name"

  # Update bio and location
  niubility profile update --bio "Hello world" --location "Shanghai"

  # Update social accounts
  niubility profile update --social github=alice --social x=@alice`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		req := &api.UpdateProfileRequest{}
		if profileUpdateName != "" {
			req.Name = &profileUpdateName
		}
		if profileUpdateBio != "" {
			req.Bio = &profileUpdateBio
		}
		if profileUpdateLocation != "" {
			req.Location = &profileUpdateLocation
		}
		if profileUpdateAvatar != "" {
			req.Avatar = &profileUpdateAvatar
		}
		if len(profileUpdateSocialAccounts) > 0 {
			socials := make(map[string]string)
			for _, s := range profileUpdateSocialAccounts {
				parts := strings.SplitN(s, "=", 2)
				if len(parts) != 2 {
					return fmt.Errorf("%s", localizedText("Profile.Update.Error.InvalidSocial", "invalid social account format: {{.Value}} (expected key=value)", map[string]interface{}{"Value": s}))
				}
				socials[parts[0]] = parts[1]
			}
			req.SocialAccounts = socials
		}

		updated, err := apiClient.UpdateProfile(ctx, req)
		if err != nil {
			return wrapLocalizedError("Profile.Update.Error.UpdateFailed", "failed to update profile", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccessT("Profile.Update.Success.Updated", "Profile updated", nil)
		return nil
	},
}

// profileChangePasswordCmd represents the change-password command
var profileChangePasswordCmd = &cobra.Command{
	Use:   "change-password",
	Short: "Change your password",
	Long:  `Change your password. You will be prompted for old and new passwords interactively.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		// Check if user has a password
		hasPassword, err := apiClient.HasPassword(ctx)
		if err != nil {
			return wrapLocalizedError("Profile.Password.Error.CheckFailed", "failed to check password status", err)
		}

		oldPassword := profileOldPassword
		newPassword := profileNewPassword

		// Interactive password input if not provided via flags
		if hasPassword.HasPassword && oldPassword == "" {
			fmt.Printf("%s: ", localizedText("Profile.Password.Label.OldPassword", "Old password", nil))
			bytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return wrapLocalizedError("Profile.Password.Error.ReadFailed", "failed to read password", err)
			}
			oldPassword = string(bytes)
		}

		if newPassword == "" {
			fmt.Printf("%s: ", localizedText("Profile.Password.Label.NewPassword", "New password", nil))
			bytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return wrapLocalizedError("Profile.Password.Error.ReadFailed", "failed to read password", err)
			}
			newPassword = string(bytes)

			fmt.Printf("%s: ", localizedText("Profile.Password.Label.ConfirmNewPassword", "Confirm new password", nil))
			confirmBytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return wrapLocalizedError("Profile.Password.Error.ReadFailed", "failed to read password", err)
			}
			if newPassword != string(confirmBytes) {
				return localizedError("Profile.Password.Error.PasswordMismatch", "passwords do not match")
			}
		}

		req := &api.ChangePasswordRequest{
			OldPassword: oldPassword,
			NewPassword: newPassword,
		}

		resp, err := apiClient.ChangePassword(ctx, req)
		if err != nil {
			return wrapLocalizedError("Profile.Password.Error.ChangeFailed", "failed to change password", err)
		}

		output.PrintSuccess(resp.Message)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(profileCmd)
	profileCmd.AddCommand(profileViewCmd)
	profileCmd.AddCommand(profileUpdateCmd)
	profileCmd.AddCommand(profileChangePasswordCmd)

	// profile update flags
	profileUpdateCmd.Flags().StringVar(&profileUpdateName, "name", "", "Display name")
	profileUpdateCmd.Flags().StringVar(&profileUpdateBio, "bio", "", "Bio")
	profileUpdateCmd.Flags().StringVar(&profileUpdateLocation, "location", "", "Location")
	profileUpdateCmd.Flags().StringVar(&profileUpdateAvatar, "avatar", "", "Avatar URL")
	profileUpdateCmd.Flags().StringArrayVar(&profileUpdateSocialAccounts, "social", nil, "Social account (key=value, e.g. github=alice)")

	// profile change-password flags
	profileChangePasswordCmd.Flags().StringVar(&profileOldPassword, "old-password", "", "Old password (will prompt if not provided)")
	profileChangePasswordCmd.Flags().StringVar(&profileNewPassword, "new-password", "", "New password (will prompt if not provided)")
}

func localizeProfileCommands() {
	profileCmd.Short = localizedText("Profile.Short", "Manage your profile", nil)
	profileCmd.Long = localizedText("Profile.Long", "View and update your profile, change password.", nil)

	profileViewCmd.Short = localizedText("Profile.View.Short", "View your profile", nil)
	profileViewCmd.Long = localizedText("Profile.View.Long", "View your current profile information.", nil)

	profileUpdateCmd.Short = localizedText("Profile.Update.Short", "Update your profile", nil)
	profileUpdateCmd.Long = localizedText("Profile.Update.Long", "Update your profile fields. Only specified fields will be changed.", nil)
	profileUpdateCmd.Example = localizedText("Profile.Update.Example", profileUpdateCmd.Example, nil)

	profileChangePasswordCmd.Short = localizedText("Profile.Password.Short", "Change your password", nil)
	profileChangePasswordCmd.Long = localizedText("Profile.Password.Long", "Change your password. You will be prompted for old and new passwords interactively.", nil)

	if flag := profileUpdateCmd.Flags().Lookup("name"); flag != nil {
		flag.Usage = localizedText("Profile.Flag.Name", "Display name", nil)
	}
	if flag := profileUpdateCmd.Flags().Lookup("bio"); flag != nil {
		flag.Usage = localizedText("Profile.Flag.Bio", "Bio", nil)
	}
	if flag := profileUpdateCmd.Flags().Lookup("location"); flag != nil {
		flag.Usage = localizedText("Profile.Flag.Location", "Location", nil)
	}
	if flag := profileUpdateCmd.Flags().Lookup("avatar"); flag != nil {
		flag.Usage = localizedText("Profile.Flag.Avatar", "Avatar URL", nil)
	}
	if flag := profileUpdateCmd.Flags().Lookup("social"); flag != nil {
		flag.Usage = localizedText("Profile.Flag.Social", "Social account (key=value, e.g. github=alice)", nil)
	}
	if flag := profileChangePasswordCmd.Flags().Lookup("old-password"); flag != nil {
		flag.Usage = localizedText("Profile.Password.Flag.OldPassword", "Old password (will prompt if not provided)", nil)
	}
	if flag := profileChangePasswordCmd.Flags().Lookup("new-password"); flag != nil {
		flag.Usage = localizedText("Profile.Password.Flag.NewPassword", "New password (will prompt if not provided)", nil)
	}
}
