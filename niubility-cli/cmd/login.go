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

	"github.com/miclle/niubility-cli/internal/api"
	"github.com/miclle/niubility-cli/internal/auth"
	"github.com/miclle/niubility-cli/internal/config"
	"github.com/miclle/niubility-cli/internal/output"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

var (
	loginServer   string
	loginUsername string
	loginPassword string
	passwordStdin bool
)

// loginCmd represents the login command
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Login to Niubility server",
	Long: `Login to Niubility server with username and password.

Examples:
  # Interactive login
  niubility login

  # Specify server
  niubility login --server http://localhost:9000

  # Non-interactive login
  niubility login --server http://localhost:9000 --username admin --password-stdin < password.txt`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Load existing config if available
		cfg, err := config.LoadFrom(cfgFile)
		if err != nil {
			// Create default config
			cfg = &config.Config{
				Server:       config.DefaultServer,
				Output:       config.DefaultOutput,
				Editor:       config.DefaultEditor,
				DefaultStatus: config.DefaultStatus,
				Timeout:      config.DefaultTimeout,
				CookieJar:    config.DefaultCookieJar,
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

		// Get username
		username := loginUsername
		if username == "" {
			fmt.Print("Username: ")
			reader := bufio.NewReader(os.Stdin)
			username, err = reader.ReadString('\n')
			if err != nil {
				return fmt.Errorf("failed to read username: %w", err)
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
					return fmt.Errorf("failed to read password: %w", err)
				}
				password = strings.TrimSpace(password)
			} else {
				fmt.Print("Password: ")
				passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
				fmt.Println() // newline after password
				if err != nil {
					return fmt.Errorf("failed to read password: %w", err)
				}
				password = string(passwordBytes)
			}
		}

		if username == "" || password == "" {
			return fmt.Errorf("username and password are required")
		}

		// Create auth manager
		authMgr, err := auth.NewManager(cfg.CookieJar, cfg.Server)
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

		// Login
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()

		_, err = apiClient.Login(ctx, username, password)
		if err != nil {
			return fmt.Errorf("login failed: %w", err)
		}

		// Save session
		if err := authMgr.Save(); err != nil {
			return fmt.Errorf("failed to save session: %w", err)
		}

		// Save config if server was provided via flag
		if loginServer != "" {
			if err := config.SaveTo(cfg, cfgFile); err != nil {
				output.PrintError("failed to save config: %v", err)
			}
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
}
