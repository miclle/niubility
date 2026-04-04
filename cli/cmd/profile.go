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
			return fmt.Errorf("failed to get profile: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		fmt.Printf("ID: %s\n", user.ID)
		fmt.Printf("Username: %s\n", user.Username)
		fmt.Printf("Name: %s\n", user.Name)
		fmt.Printf("Email: %s\n", user.Email)
		if user.Mobile != "" {
			fmt.Printf("Mobile: %s\n", user.Mobile)
		}
		if user.Bio != "" {
			fmt.Printf("Bio: %s\n", user.Bio)
		}
		if user.Location != "" {
			fmt.Printf("Location: %s\n", user.Location)
		}
		fmt.Printf("Role: %s\n", user.Role)
		fmt.Printf("Status: %s\n", user.Status)
		fmt.Printf("Followers: %d | Following: %d\n", user.FollowerCount, user.FollowingCount)
		if len(user.SocialAccounts) > 0 {
			fmt.Printf("Social: ")
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
					return fmt.Errorf("invalid social account format: %s (expected key=value)", s)
				}
				socials[parts[0]] = parts[1]
			}
			req.SocialAccounts = socials
		}

		updated, err := apiClient.UpdateProfile(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to update profile: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(updated)
		}

		output.PrintSuccess("Profile updated")
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
			return fmt.Errorf("failed to check password status: %w", err)
		}

		oldPassword := profileOldPassword
		newPassword := profileNewPassword

		// Interactive password input if not provided via flags
		if hasPassword.HasPassword && oldPassword == "" {
			fmt.Print("Old password: ")
			bytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return fmt.Errorf("failed to read password: %w", err)
			}
			oldPassword = string(bytes)
		}

		if newPassword == "" {
			fmt.Print("New password: ")
			bytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return fmt.Errorf("failed to read password: %w", err)
			}
			newPassword = string(bytes)

			fmt.Print("Confirm new password: ")
			confirmBytes, err := term.ReadPassword(0)
			fmt.Println()
			if err != nil {
				return fmt.Errorf("failed to read password: %w", err)
			}
			if newPassword != string(confirmBytes) {
				return fmt.Errorf("passwords do not match")
			}
		}

		req := &api.ChangePasswordRequest{
			OldPassword: oldPassword,
			NewPassword: newPassword,
		}

		resp, err := apiClient.ChangePassword(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to change password: %w", err)
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
