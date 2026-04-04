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
			return fmt.Errorf("server address is required. Use --server flag or set it in config")
		}

		if loginSSO && (loginUsername != "" || loginPassword != "" || passwordStdin) {
			return fmt.Errorf("--sso cannot be used with username/password flags")
		}

		// Create auth manager
		authMgr, err := auth.NewManager(cfg.Token, cfg.Server)
		if err != nil {
			return fmt.Errorf("failed to create auth manager: %w", err)
		}

		// Parse timeout
		timeout, err := time.ParseDuration(cfg.Timeout)
		if err != nil {
			timeout = 30 * time.Second
		}

		// Create API client
		apiClient, err := api.NewClient(cfg.Server, timeout, authMgr.GetJar())
		if err != nil {
			return fmt.Errorf("failed to create API client: %w", err)
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
				return fmt.Errorf("SSO login failed: %w", err)
			}
		} else {
			username, password, err := readPasswordLoginInput()
			if err != nil {
				return err
			}

			_, err = apiClient.Login(ctx, username, password)
			if err != nil {
				return fmt.Errorf("login failed: %w", err)
			}
		}

		if err := authMgr.SyncFromJar(); err != nil {
			return fmt.Errorf("failed to sync auth token: %w", err)
		}
		cfg.Token = authMgr.GetAccessToken()
		apiClient.SetAccessToken(cfg.Token)

		// Persist config after successful login so server/token stay in sync.
		if err := config.SaveProfile(profileName, cfg, cfgFile); err != nil {
			output.PrintError("failed to save config: %v", err)
		}

		// Verify login with boot endpoint
		boot, err := apiClient.Boot(ctx)
		if err != nil {
			return fmt.Errorf("failed to verify login: %w", err)
		}

		// Output
		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(map[string]interface{}{
				"authenticated": boot.IsAuthenticated(),
				"user":          boot.User,
				"server":        cfg.Server,
			})
		}

		output.PrintSuccess("Logged in as %s", boot.User.Name)
		fmt.Printf("Server: %s\n", cfg.Server)
		if profileName != "" {
			fmt.Printf("Profile: %s\n", profileName)
		}
		fmt.Printf("Username: %s\n", boot.User.Username)
		fmt.Printf("Role: %s\n", boot.User.Role)

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
		fmt.Print("Username: ")
		reader := bufio.NewReader(os.Stdin)
		username, err = reader.ReadString('\n')
		if err != nil {
			return "", "", fmt.Errorf("failed to read username: %w", err)
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
				return "", "", fmt.Errorf("failed to read password: %w", err)
			}
			password = strings.TrimSpace(password)
		} else {
			fmt.Print("Password: ")
			passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
			fmt.Println()
			if err != nil {
				return "", "", fmt.Errorf("failed to read password: %w", err)
			}
			password = string(passwordBytes)
		}
	}

	if username == "" || password == "" {
		return "", "", fmt.Errorf("username and password are required")
	}

	return username, password, nil
}
