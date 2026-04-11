package cmd

import (
	"strings"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var (
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
)

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

func init() {
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
}

func localizeUserCreateCommand() {
	userCreateCmd.Short = localizedText("User.Create.Short", "Create a user", nil)
	userCreateCmd.Long = localizedText("User.Create.Long", "Create a user with admin permission.", nil)

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
}
