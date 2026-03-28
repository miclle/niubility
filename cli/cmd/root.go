// Package cmd provides CLI commands
package cmd

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/auth"
	"github.com/miclle/niubility/cli/internal/config"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	// cfgFile is the config file path
	cfgFile string
	// profileName selects an isolated CLI profile
	profileName string

	// global config
	cfg *config.Config

	// auth manager
	authMgr *auth.Manager

	// api client
	apiClient *api.Client

	// output format
	outputFormat string
)

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "niubility",
	Short: "CLI tool for Niubility platform",
	Long: `Niubility CLI allows you to interact with Niubility platform from the command line.

You can browse content, publish articles, manage categories, and more.

Start by logging in:
  niubility login --server http://your-server:9000`,
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		if err := config.ValidateProfile(profileName); err != nil {
			return err
		}

		// Skip initialization for login command if server not configured
		if cmd.Name() == "login" {
			return nil
		}

		// Load config from specified path or default
		var err error
		cfg, err = config.LoadProfile(profileName, cfgFile)
		if err != nil {
			return fmt.Errorf("failed to load config: %w", err)
		}

		// Override with command line flags
		if outputFormat != "" {
			cfg.Output = outputFormat
		}

		// Check if server is configured
		if cfg.Server == "" {
			return fmt.Errorf("server not configured. Run 'niubility login --server <url>' first")
		}

		// Parse timeout
		timeout, err := time.ParseDuration(cfg.Timeout)
		if err != nil {
			return fmt.Errorf("invalid timeout: %w", err)
		}

		// Create auth manager
		authMgr, err = auth.NewManager(cfg.CookieJar, cfg.Server)
		if err != nil {
			return fmt.Errorf("failed to create auth manager: %w", err)
		}

		// Create API client
		apiClient, err = api.NewClient(cfg.Server, timeout, authMgr.GetJar())
		if err != nil {
			return fmt.Errorf("failed to create API client: %w", err)
		}

		return nil
	},
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is ~/.config/niubility/config.yaml)")
	rootCmd.PersistentFlags().StringVar(&profileName, "profile", "", "isolated profile name for multi-server login")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "", "output format (table or json)")
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	}
}

// getPrinter returns a printer with the configured format
func getPrinter() *output.Printer {
	format := output.FormatTable
	if cfg != nil && cfg.Output == "json" {
		format = output.FormatJSON
	}
	if outputFormat == "json" {
		format = output.FormatJSON
	}
	return output.NewPrinter(format)
}

// isJSONOutput returns true if JSON output is requested
func isJSONOutput() bool {
	return outputFormat == "json" || (cfg != nil && cfg.Output == "json")
}

// requireAuth checks if user is authenticated
func requireAuth() error {
	if authMgr == nil || !authMgr.HasSession() {
		return fmt.Errorf("not logged in. Run 'niubility login' first")
	}
	return nil
}

// getContext returns a context with timeout
func getContext() (context.Context, context.CancelFunc) {
	timeout := 30 * time.Second
	if cfg != nil {
		if t, err := time.ParseDuration(cfg.Timeout); err == nil {
			timeout = t
		}
	}
	return context.WithTimeout(context.Background(), timeout)
}
