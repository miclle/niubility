package cmd

import (
	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
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
)

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

func init() {
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
}

func localizeUserUpdateCommand() {
	userUpdateCmd.Short = localizedText("User.Update.Short", "Update a user", nil)
	userUpdateCmd.Long = localizedText("User.Update.Long", "Update user fields with admin permission.", nil)

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
}
