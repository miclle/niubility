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
	Use:     "user",
	Aliases: []string{"usr"},
	Short:   "Manage users",
	Long:    `Manage users on Niubility platform. Most subcommands require admin permission.`,
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
			return wrapLocalizedError("User.List.Error.ListFailed", "failed to list users", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(resp)
		}

		if len(resp.Items) == 0 {
			printLocalizedMessage("User.List.Empty", "No users found", nil)
			return nil
		}

		table := output.NewTable(
			localizedText("Common.Label.Identifier", "ID", nil),
			localizedText("Common.Label.Username", "USERNAME", nil),
			localizedText("Common.Label.Name", "NAME", nil),
			localizedText("Common.Label.Email", "EMAIL", nil),
			localizedText("Common.Label.Role", "ROLE", nil),
			localizedText("Common.Label.Status", "STATUS", nil),
			localizedText("Common.Label.Departments", "DEPARTMENTS", nil),
			localizedText("Common.Label.Created", "CREATED", nil),
		)
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
			printTotal(*resp.Total)
		}
		if resp.HasMore() {
			fmt.Print(localizedText("Common.Message.MoreResults", "More results available. Use --cursor {{.Cursor}} to get next page.", map[string]interface{}{"Cursor": resp.NextCursor}))
			fmt.Println()
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

var userCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a user",
	Long:  `Create a user with admin permission.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx, cancel := getContext()
		defer cancel()

		if strings.TrimSpace(userCreateUsername) == "" {
			return localizedError("User.Create.Error.UsernameRequired", "--username is required")
		}
		if strings.TrimSpace(userCreateEmail) == "" {
			return localizedError("User.Create.Error.EmailRequired", "--email is required")
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
			return wrapLocalizedError("User.Create.Error.CreateFailed", "failed to create user", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		output.PrintSuccessT("User.Create.Success.Created", "created user {{.Username}} ({{.ID}})", map[string]interface{}{"Username": user.Username, "ID": user.ID})
		printLocalizedField("Common.Label.Role", "Role", user.Role)
		printLocalizedField("Common.Label.Status", "Status", user.Status)
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
			return localizedError("User.Update.Error.NoFields", "no fields to update; pass at least one flag")
		}

		user, err := apiClient.UpdateUser(ctx, args[0], req)
		if err != nil {
			return wrapLocalizedError("User.Update.Error.UpdateFailed", "failed to update user", err)
		}

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(user)
		}

		output.PrintSuccessT("User.Update.Success.Updated", "updated user {{.Username}} ({{.ID}})", map[string]interface{}{"Username": user.Username, "ID": user.ID})
		printLocalizedField("Common.Label.Role", "Role", user.Role)
		printLocalizedField("Common.Label.Status", "Status", user.Status)
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
			printLocalizedMessage("User.Delete.Prompt", "Delete user {{.ID}}? This cannot be undone. Use --yes to confirm.", map[string]interface{}{"ID": id})
			return nil
		}

		ctx, cancel := getContext()
		defer cancel()

		if err := apiClient.DeleteUser(ctx, id); err != nil {
			return wrapLocalizedError("User.Delete.Error.DeleteFailed", "failed to delete user", err)
		}

		output.PrintSuccessT("User.Delete.Success.Deleted", "deleted user {{.ID}}", map[string]interface{}{"ID": id})
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
			return nil, fmt.Errorf("%s", localizedText("User.Error.InvalidSocial", "invalid --social value {{.Value}}, expected key=value", map[string]interface{}{"Value": fmt.Sprintf("%q", item)}))
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

func localizeUserCommands() {
	userCmd.Short = localizedText("User.Short", "Manage users", nil)
	userCmd.Long = localizedText("User.Long", "Manage users on Niubility platform. Most subcommands require admin permission.", nil)

	userListCmd.Short = localizedText("User.List.Short", "List users", nil)
	userListCmd.Long = localizedText("User.List.Long", "List users with optional search and department filters.", nil)

	userViewCmd.Short = localizedText("User.View.Short", "View user details", nil)

	userCreateCmd.Short = localizedText("User.Create.Short", "Create a user", nil)
	userCreateCmd.Long = localizedText("User.Create.Long", "Create a user with admin permission.", nil)

	userUpdateCmd.Short = localizedText("User.Update.Short", "Update a user", nil)
	userUpdateCmd.Long = localizedText("User.Update.Long", "Update user fields with admin permission.", nil)

	userDeleteCmd.Short = localizedText("User.Delete.Short", "Delete a user", nil)

	if flag := userListCmd.Flags().Lookup("limit"); flag != nil {
		flag.Usage = localizedText("User.Flag.ListLimit", "maximum number of users to return", nil)
	}
	if flag := userListCmd.Flags().Lookup("cursor"); flag != nil {
		flag.Usage = localizedText("User.Flag.ListCursor", "cursor for next page", nil)
	}
	if flag := userListCmd.Flags().Lookup("search"); flag != nil {
		flag.Usage = localizedText("User.Flag.Search", "search by name, username, email, or mobile", nil)
	}
	if flag := userListCmd.Flags().Lookup("department-id"); flag != nil {
		flag.Usage = localizedText("User.Flag.DepartmentID", "filter by department ID", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("username"); flag != nil {
		flag.Usage = localizedText("User.Flag.Username", "username", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("email"); flag != nil {
		flag.Usage = localizedText("User.Flag.Email", "email", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("password"); flag != nil {
		flag.Usage = localizedText("User.Flag.Password", "password", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("name"); flag != nil {
		flag.Usage = localizedText("User.Flag.Name", "display name", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("mobile"); flag != nil {
		flag.Usage = localizedText("User.Flag.Mobile", "mobile number", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("avatar"); flag != nil {
		flag.Usage = localizedText("User.Flag.Avatar", "avatar URL or asset path", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("bio"); flag != nil {
		flag.Usage = localizedText("User.Flag.Bio", "bio", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("location"); flag != nil {
		flag.Usage = localizedText("User.Flag.Location", "location", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("department-ids"); flag != nil {
		flag.Usage = localizedText("User.Flag.DepartmentIDs", "comma-separated department IDs", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("role"); flag != nil {
		flag.Usage = localizedText("User.Flag.Role", "role: user, admin, super_admin", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("User.Flag.Status", "status: activated, deactivated", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("created-at"); flag != nil {
		flag.Usage = localizedText("User.Flag.CreatedAt", "custom created_at in RFC3339 format", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("updated-at"); flag != nil {
		flag.Usage = localizedText("User.Flag.UpdatedAt", "custom updated_at in RFC3339 format", nil)
	}
	if flag := userCreateCmd.Flags().Lookup("social"); flag != nil {
		flag.Usage = localizedText("User.Flag.Social", "social account in key=value form, repeatable", nil)
	}

	if flag := userUpdateCmd.Flags().Lookup("username"); flag != nil {
		flag.Usage = localizedText("User.Flag.Username", "username", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("email"); flag != nil {
		flag.Usage = localizedText("User.Flag.Email", "email", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("password"); flag != nil {
		flag.Usage = localizedText("User.Update.Flag.Password", "password; pass empty string to clear", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("name"); flag != nil {
		flag.Usage = localizedText("User.Flag.Name", "display name", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("mobile"); flag != nil {
		flag.Usage = localizedText("User.Flag.Mobile", "mobile number", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("avatar"); flag != nil {
		flag.Usage = localizedText("User.Flag.Avatar", "avatar URL or asset path", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("bio"); flag != nil {
		flag.Usage = localizedText("User.Flag.Bio", "bio", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("location"); flag != nil {
		flag.Usage = localizedText("User.Flag.Location", "location", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("department-ids"); flag != nil {
		flag.Usage = localizedText("User.Flag.DepartmentIDs", "comma-separated department IDs", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("role"); flag != nil {
		flag.Usage = localizedText("User.Flag.Role", "role: user, admin, super_admin", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("status"); flag != nil {
		flag.Usage = localizedText("User.Flag.Status", "status: activated, deactivated", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("created-at"); flag != nil {
		flag.Usage = localizedText("User.Flag.CreatedAt", "custom created_at in RFC3339 format", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("updated-at"); flag != nil {
		flag.Usage = localizedText("User.Flag.UpdatedAt", "custom updated_at in RFC3339 format", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("social"); flag != nil {
		flag.Usage = localizedText("User.Flag.Social", "social account in key=value form, repeatable", nil)
	}
	if flag := userUpdateCmd.Flags().Lookup("clear-socials"); flag != nil {
		flag.Usage = localizedText("User.Update.Flag.ClearSocials", "clear all social accounts", nil)
	}
	if flag := userDeleteCmd.Flags().Lookup("yes"); flag != nil {
		flag.Usage = localizedText("User.Delete.Flag.Yes", "skip confirmation", nil)
	}
}
