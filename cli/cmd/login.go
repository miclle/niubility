// Package cmd provides CLI commands
package cmd

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/auth"
	"github.com/miclle/niubility/cli/internal/config"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var (
	loginServer   string
	loginUsername string
	loginPassword string
	passwordStdin bool
	loginSSO      bool
)

type loginMode string

const (
	loginModePassword loginMode = "password"
	loginModeSSO      loginMode = "sso"
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to Niubility server",
	Long: `Login to Niubility server with username/password or SSO.

If the server has SSO enabled, browser-based SSO is used by default unless
username/password flags are provided.

Examples:
  # Interactive login
  niubility login

 # Specify server
  niubility login --server http://localhost:9000

  # Login with SSO
  niubility login --server http://localhost:9000 --sso

  # Non-interactive login
  niubility login --server http://localhost:9000 --username admin --password-stdin < password.txt`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := config.ValidateProfile(profileName); err != nil {
			return err
		}

		// Load existing config if available
		cfg, err := config.LoadProfile(profileName, cfgFile)
		if err != nil {
			// Create default config
			cfg = &config.Config{
				Server:        config.DefaultServer,
				Output:        config.DefaultOutput,
				Editor:        config.DefaultEditor,
				DefaultStatus: config.DefaultStatus,
				Timeout:       config.DefaultTimeout,
				Token:         "",
			}
		}

		// Override server from flag
		if loginServer != "" {
			cfg.Server = loginServer
		}

		// Ensure server is set
		if cfg.Server == "" {
			return localizedError("Login.Error.ServerRequired", "server address is required. Use --server flag or set it in config")
		}

		if loginSSO && (loginUsername != "" || loginPassword != "" || passwordStdin) {
			return localizedError("Login.Error.SSOConflict", "--sso cannot be used with username/password flags")
		}

		// Create auth manager
		authMgr, err := auth.NewManager(cfg.Token, cfg.Server)
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedCreateAuthManager", "failed to create auth manager", err)
		}

		// Parse timeout
		timeout, err := time.ParseDuration(cfg.Timeout)
		if err != nil {
			timeout = 30 * time.Second
		}

		// Create API client
		apiClient, err := api.NewClient(cfg.Server, timeout, authMgr.GetJar())
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedCreateAPIClient", "failed to create API client", err)
		}
		apiClient.SetClientIdentity("cli", "", authMgr.GetClientName())
		apiClient.SetAccessToken(authMgr.GetAccessToken())

		// Login
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		mode, err := resolveLoginMode(ctx, apiClient)
		if err != nil {
			return err
		}

		if mode == loginModeSSO {
			if err := auth.SSOLogin(ctx, apiClient); err != nil {
				return wrapLocalizedError("Login.Error.SSOFailed", "SSO login failed", err)
			}
		} else {
			username, password, err := readPasswordLoginInput()
			if err != nil {
				return err
			}

			_, err = apiClient.Login(ctx, username, password)
			if err != nil {
				return wrapLocalizedError("Login.Error.LoginFailed", "login failed", err)
			}
		}

		if err := authMgr.SyncFromJar(); err != nil {
			return wrapLocalizedError("Login.Error.FailedSyncAuthToken", "failed to sync auth token", err)
		}
		cfg.Token = authMgr.GetAccessToken()
		apiClient.SetAccessToken(cfg.Token)

		// Persist config after successful login so server/token stay in sync.
		if err := config.SaveProfile(profileName, cfg, cfgFile); err != nil {
			output.PrintError("%s: %v", clii18n.T("Login.Error.FailedSaveConfig", "failed to save config", nil), err)
		}

		// Verify login with boot endpoint
		boot, err := apiClient.Boot(ctx)
		if err != nil {
			return wrapLocalizedError("Login.Error.FailedVerifyLogin", "failed to verify login", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(map[string]interface{}{
				"authenticated": boot.IsAuthenticated(),
				"user":          boot.User,
				"server":        cfg.Server,
			})
		}

		output.PrintSuccessT("Login.Success.LoggedInAs", "Logged in as {{.Name}}", map[string]interface{}{"Name": boot.User.Name})
		printLocalizedField("Common.Label.Server", "Server", cfg.Server)
		if profileName != "" {
			printLocalizedField("Common.Label.Profile", "Profile", profileName)
		}
		printLocalizedField("Common.Label.Username", "Username", boot.User.Username)
		printLocalizedField("Common.Label.Role", "Role", boot.User.Role)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(loginCmd)

	loginCmd.Flags().StringVarP(&loginServer, "server", "s", "", "Niubility server URL")
	loginCmd.Flags().StringVarP(&loginUsername, "username", "u", "", "Username")
	loginCmd.Flags().StringVarP(&loginPassword, "password", "p", "", "Password (use --password-stdin for non-interactive)")
	loginCmd.Flags().BoolVar(&passwordStdin, "password-stdin", false, "Read password from stdin")
	loginCmd.Flags().BoolVar(&loginSSO, "sso", false, "Login with browser-based SSO")
}

func resolveLoginMode(ctx context.Context, apiClient *api.Client) (loginMode, error) {
	if loginSSO {
		return loginModeSSO, nil
	}

	if loginUsername != "" || loginPassword != "" || passwordStdin {
		return loginModePassword, nil
	}

	boot, err := apiClient.Boot(ctx)
	if err != nil {
		return loginModePassword, nil
	}
	if boot.EnableSSO {
		return loginModeSSO, nil
	}

	return loginModePassword, nil
}

func readPasswordLoginInput() (string, string, error) {
	// Get username
	username := loginUsername
	var err error
	if username == "" {
		fmt.Printf("%s: ", clii18n.T("Common.Label.Username", "Username", nil))
		reader := bufio.NewReader(os.Stdin)
		username, err = reader.ReadString('\n')
		if err != nil {
			return "", "", wrapLocalizedError("Login.Error.FailedReadUsername", "failed to read username", err)
		}
		username = strings.TrimSpace(username)
	}

	// Get password
	password := loginPassword
	if password == "" {
		if passwordStdin {
			reader := bufio.NewReader(os.Stdin)
			password, err = reader.ReadString('\n')
			if err != nil {
				return "", "", wrapLocalizedError("Login.Error.FailedReadPassword", "failed to read password", err)
			}
			password = strings.TrimSpace(password)
		} else {
			fmt.Printf("%s: ", clii18n.T("Common.Label.Password", "Password", nil))
			passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
			fmt.Println()
			if err != nil {
				return "", "", wrapLocalizedError("Login.Error.FailedReadPassword", "failed to read password", err)
			}
			password = string(passwordBytes)
		}
	}

	if username == "" || password == "" {
		return "", "", localizedError("Login.Error.CredentialsRequired", "username and password are required")
	}

	return username, password, nil
}

func localizeAuthCommands() {
	loginCmd.Short = clii18n.T("Login.Short", "Login to Niubility server", nil)
	loginCmd.Long = clii18n.T("Login.Long", loginCmd.Long, nil)
	if flag := loginCmd.Flags().Lookup("server"); flag != nil {
		flag.Usage = clii18n.T("Login.Flag.Server", "Niubility server URL", nil)
	}
	if flag := loginCmd.Flags().Lookup("username"); flag != nil {
		flag.Usage = clii18n.T("Login.Flag.Username", "Username", nil)
	}
	if flag := loginCmd.Flags().Lookup("password"); flag != nil {
		flag.Usage = clii18n.T("Login.Flag.Password", "Password (use --password-stdin for non-interactive)", nil)
	}
	if flag := loginCmd.Flags().Lookup("password-stdin"); flag != nil {
		flag.Usage = clii18n.T("Login.Flag.PasswordStdin", "Read password from stdin", nil)
	}
	if flag := loginCmd.Flags().Lookup("sso"); flag != nil {
		flag.Usage = clii18n.T("Login.Flag.SSO", "Login with browser-based SSO", nil)
	}

	whoamiCmd.Short = clii18n.T("WhoAmI.Short", "Show current logged in user", nil)
	whoamiCmd.Long = clii18n.T("WhoAmI.Long", whoamiCmd.Long, nil)

	logoutCmd.Short = clii18n.T("Logout.Short", "Logout from Niubility server", nil)
	logoutCmd.Long = clii18n.T("Logout.Long", logoutCmd.Long, nil)
}
