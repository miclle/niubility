// Package cmd provides CLI commands
package cmd

import (
	"fmt"
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
	userListLimit        int
	userListCursor       string
	userListSearch       string
	userListDepartmentID int64

	userCreateUsername      string
	userCreateEmail         string
	userCreatePassword      string
	userCreateName          string
	userCreateMobile        string
	userCreateAvatar        string
	userCreateBio           string
	userCreateLocation      string
	userCreateDepartmentIDs string
	userCreateRole          string
	userCreateStatus        string
	userCreateCreatedAt     string
	userCreateUpdatedAt     string
	userCreateSocials       []string

	userUpdateUsername      string
	userUpdateEmail         string
	userUpdatePassword      string
	userUpdateName          string
	userUpdateMobile        string
	userUpdateAvatar        string
	userUpdateBio           string
	userUpdateLocation      string
	userUpdateDepartmentIDs string
	userUpdateRole          string
	userUpdateStatus        string
	userUpdateCreatedAt     string
	userUpdateUpdatedAt     string
	userUpdateSocials       []string
	userUpdateClearSocials  bool

	userDeleteYes bool
)

var userCmd = &cobra.Command{
	Use:   "user",
	Short: "Manage users",
	Long:  `Manage users on Niubility platform. Most subcommands require admin permission.`,
}

var userListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List users",
	Long:    `List users with optional search and department filters.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		resp, err := apiClient.ListUsers(ctx, &api.UserListOptions{
			Limit:        userListLimit,
			Cursor:       userListCursor,
			Search:       userListSearch,
			DepartmentID: userListDepartmentID,
		})
		if err != nil {
			return fmt.Errorf("failed to list users: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			fmt.Println("No users found")
			return nil
		}

		table := output.NewTable("ID", "USERNAME", "NAME", "EMAIL", "ROLE", "STATUS", "DEPARTMENTS", "CREATED")
		for _, user := range resp.Items {
			table.AddRow(
				user.ID,
				user.Username,
				output.Truncate(user.Name, 20),
				output.Truncate(user.Email, 28),
				user.Role,
				user.Status,
				output.Truncate(user.DepartmentIDs, 18),
				output.FormatTime(user.CreatedAt),
			)
		}
		table.Print()

		if resp.Total != nil {
			fmt.Printf("\nTotal: %d\n", *resp.Total)
		}
		if resp.HasMore() {
			fmt.Printf("More results available. Use --cursor %s to get next page.\n", resp.NextCursor)
		}

		return nil
	},
}

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
			return fmt.Errorf("failed to get user: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		fmt.Printf("ID: %s\n", user.ID)
		fmt.Printf("Username: %s\n", user.Username)
		fmt.Printf("Name: %s\n", user.Name)
		fmt.Printf("Email: %s\n", user.Email)
		fmt.Printf("Role: %s\n", user.Role)
		fmt.Printf("Status: %s\n", user.Status)
		if user.Mobile != "" {
			fmt.Printf("Mobile: %s\n", user.Mobile)
		}
		if user.Location != "" {
			fmt.Printf("Location: %s\n", user.Location)
		}
		if user.DepartmentIDs != "" {
			fmt.Printf("Department IDs: %s\n", user.DepartmentIDs)
		}
		if user.Avatar != "" {
			fmt.Printf("Avatar: %s\n", user.Avatar)
		}
		if user.Bio != "" {
			fmt.Printf("Bio: %s\n", user.Bio)
		}
		if len(user.SocialAccounts) > 0 {
			fmt.Println("Social Accounts:")
			for key, value := range user.SocialAccounts {
				fmt.Printf("  %s=%s\n", key, value)
			}
		}
		fmt.Printf("Followers: %d\n", user.FollowerCount)
		fmt.Printf("Following: %d\n", user.FollowingCount)
		fmt.Printf("Created: %s\n", output.FormatTime(user.CreatedAt))
		fmt.Printf("Updated: %s\n", output.FormatTime(user.UpdatedAt))

		return nil
	},
}

var userCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a user",
	Long:  `Create a user with admin permission.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		if strings.TrimSpace(userCreateUsername) == "" {
			return fmt.Errorf("--username is required")
		}
		if strings.TrimSpace(userCreateEmail) == "" {
			return fmt.Errorf("--email is required")
		}

		socialAccounts, err := parseSocialAccounts(userCreateSocials)
		if err != nil {
			return err
		}

		req := &api.CreateUserRequest{
			Username:       strings.TrimSpace(userCreateUsername),
			Email:          strings.TrimSpace(userCreateEmail),
			Password:       optionalStringFlag(cmd, "password", userCreatePassword),
			Name:           optionalStringFlag(cmd, "name", userCreateName),
			Mobile:         optionalStringFlag(cmd, "mobile", userCreateMobile),
			Avatar:         optionalStringFlag(cmd, "avatar", userCreateAvatar),
			Bio:            optionalStringFlag(cmd, "bio", userCreateBio),
			Location:       optionalStringFlag(cmd, "location", userCreateLocation),
			DepartmentIDs:  optionalStringFlag(cmd, "department-ids", userCreateDepartmentIDs),
			Role:           optionalStringFlag(cmd, "role", userCreateRole),
			Status:         optionalStringFlag(cmd, "status", userCreateStatus),
			CreatedAt:      optionalStringFlag(cmd, "created-at", userCreateCreatedAt),
			UpdatedAt:      optionalStringFlag(cmd, "updated-at", userCreateUpdatedAt),
			SocialAccounts: socialAccounts,
		}

		user, err := apiClient.CreateUser(ctx, req)
		if err != nil {
			return fmt.Errorf("failed to create user: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		output.PrintSuccess("created user %s (%s)", user.Username, user.ID)
		fmt.Printf("Role: %s\n", user.Role)
		fmt.Printf("Status: %s\n", user.Status)
		return nil
	},
}

var userUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a user",
	Long:  `Update user fields with admin permission.`,
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		socialAccounts, err := parseSocialAccounts(userUpdateSocials)
		if err != nil {
			return err
		}

		req := &api.UpdateUserRequest{
			Username:      optionalStringFlag(cmd, "username", userUpdateUsername),
			Email:         optionalStringFlag(cmd, "email", userUpdateEmail),
			Password:      optionalStringFlag(cmd, "password", userUpdatePassword),
			Name:          optionalStringFlag(cmd, "name", userUpdateName),
			Mobile:        optionalStringFlag(cmd, "mobile", userUpdateMobile),
			Avatar:        optionalStringFlag(cmd, "avatar", userUpdateAvatar),
			Bio:           optionalStringFlag(cmd, "bio", userUpdateBio),
			Location:      optionalStringFlag(cmd, "location", userUpdateLocation),
			DepartmentIDs: optionalStringFlag(cmd, "department-ids", userUpdateDepartmentIDs),
			Role:          optionalStringFlag(cmd, "role", userUpdateRole),
			Status:        optionalStringFlag(cmd, "status", userUpdateStatus),
			CreatedAt:     optionalStringFlag(cmd, "created-at", userUpdateCreatedAt),
			UpdatedAt:     optionalStringFlag(cmd, "updated-at", userUpdateUpdatedAt),
		}

		if cmd.Flags().Changed("social") {
			req.SocialAccounts = socialAccounts
		}
		if userUpdateClearSocials {
			req.SocialAccounts = map[string]string{}
		}
		if isEmptyUpdateRequest(req) {
			return fmt.Errorf("no fields to update; pass at least one flag")
		}

		user, err := apiClient.UpdateUser(ctx, args[0], req)
		if err != nil {
			return fmt.Errorf("failed to update user: %w", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		output.PrintSuccess("updated user %s (%s)", user.Username, user.ID)
		fmt.Printf("Role: %s\n", user.Role)
		fmt.Printf("Status: %s\n", user.Status)
		return nil
	},
}

var userDeleteCmd = &cobra.Command{
	Use:     "delete <id>",
	Aliases: []string{"rm"},
	Short:   "Delete a user",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		id := args[0]
		if !userDeleteYes {
			fmt.Printf("Delete user %s? This cannot be undone. Use --yes to confirm.\n", id)
			return nil
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteUser(ctx, id); err != nil {
			return fmt.Errorf("failed to delete user: %w", err)
		}

		output.PrintSuccess("deleted user %s", id)
		return nil
	},
}

func optionalStringFlag(cmd *cobra.Command, name, value string) *string {
	if !cmd.Flags().Changed(name) {
		return nil
	}
	v := value
	return &v
}

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
			return nil, fmt.Errorf("invalid --social value %q, expected key=value", item)
		}
		socialAccounts[key] = value
	}
	return socialAccounts, nil
}

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

func init() {
	rootCmd.AddCommand(userCmd)

	userCmd.AddCommand(userListCmd)
	userListCmd.Flags().IntVarP(&userListLimit, "limit", "n", 20, "maximum number of users to return")
	userListCmd.Flags().StringVar(&userListCursor, "cursor", "", "cursor for next page")
	userListCmd.Flags().StringVar(&userListSearch, "search", "", "search by name, username, email, or mobile")
	userListCmd.Flags().Int64Var(&userListDepartmentID, "department-id", 0, "filter by department ID")

	userCmd.AddCommand(userViewCmd)

	userCmd.AddCommand(userCreateCmd)
	userCreateCmd.Flags().StringVar(&userCreateUsername, "username", "", "username")
	userCreateCmd.Flags().StringVar(&userCreateEmail, "email", "", "email")
	userCreateCmd.Flags().StringVar(&userCreatePassword, "password", "", "password")
	userCreateCmd.Flags().StringVar(&userCreateName, "name", "", "display name")
	userCreateCmd.Flags().StringVar(&userCreateMobile, "mobile", "", "mobile number")
	userCreateCmd.Flags().StringVar(&userCreateAvatar, "avatar", "", "avatar URL or asset path")
	userCreateCmd.Flags().StringVar(&userCreateBio, "bio", "", "bio")
	userCreateCmd.Flags().StringVar(&userCreateLocation, "location", "", "location")
	userCreateCmd.Flags().StringVar(&userCreateDepartmentIDs, "department-ids", "", "comma-separated department IDs")
	userCreateCmd.Flags().StringVar(&userCreateRole, "role", "", "role: user, admin, super_admin")
	userCreateCmd.Flags().StringVar(&userCreateStatus, "status", "", "status: activated, deactivated")
	userCreateCmd.Flags().StringVar(&userCreateCreatedAt, "created-at", "", "custom created_at in RFC3339 format")
	userCreateCmd.Flags().StringVar(&userCreateUpdatedAt, "updated-at", "", "custom updated_at in RFC3339 format")
	userCreateCmd.Flags().StringSliceVar(&userCreateSocials, "social", nil, "social account in key=value form, repeatable")

	userCmd.AddCommand(userUpdateCmd)
	userUpdateCmd.Flags().StringVar(&userUpdateUsername, "username", "", "username")
	userUpdateCmd.Flags().StringVar(&userUpdateEmail, "email", "", "email")
	userUpdateCmd.Flags().StringVar(&userUpdatePassword, "password", "", "password; pass empty string to clear")
	userUpdateCmd.Flags().StringVar(&userUpdateName, "name", "", "display name")
	userUpdateCmd.Flags().StringVar(&userUpdateMobile, "mobile", "", "mobile number")
	userUpdateCmd.Flags().StringVar(&userUpdateAvatar, "avatar", "", "avatar URL or asset path")
	userUpdateCmd.Flags().StringVar(&userUpdateBio, "bio", "", "bio")
	userUpdateCmd.Flags().StringVar(&userUpdateLocation, "location", "", "location")
	userUpdateCmd.Flags().StringVar(&userUpdateDepartmentIDs, "department-ids", "", "comma-separated department IDs")
	userUpdateCmd.Flags().StringVar(&userUpdateRole, "role", "", "role: user, admin, super_admin")
	userUpdateCmd.Flags().StringVar(&userUpdateStatus, "status", "", "status: activated, deactivated")
	userUpdateCmd.Flags().StringVar(&userUpdateCreatedAt, "created-at", "", "custom created_at in RFC3339 format")
	userUpdateCmd.Flags().StringVar(&userUpdateUpdatedAt, "updated-at", "", "custom updated_at in RFC3339 format")
	userUpdateCmd.Flags().StringSliceVar(&userUpdateSocials, "social", nil, "social account in key=value form, repeatable")
	userUpdateCmd.Flags().BoolVar(&userUpdateClearSocials, "clear-socials", false, "clear all social accounts")

	userCmd.AddCommand(userDeleteCmd)
	userDeleteCmd.Flags().BoolVarP(&userDeleteYes, "yes", "y", false, "skip confirmation")
}
