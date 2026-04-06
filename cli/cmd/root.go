// Package cmd provides CLI commands
package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/miclle/niubility/cli/internal/api"
	"github.com/miclle/niubility/cli/internal/auth"
	"github.com/miclle/niubility/cli/internal/config"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
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

	// language controls human-readable CLI output.
	languageOption string
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

		// Local-only commands manage config without requiring a server session.
		if isLocalOnlyCommand(cmd) {
			return nil
		}

		// Load config from specified path or default
		var err error
		cfg, err = config.LoadProfile(profileName, cfgFile)
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedLoadConfig", "failed to load config", err)
		}

		// Override with command line flags
		if outputFormat != "" {
			cfg.Output = outputFormat
		}

		// Check if server is configured
		if cfg.Server == "" {
			return localizedError("Root.Error.ServerNotConfigured", "server not configured. Run 'niubility login --server <url>' first")
		}

		// Parse timeout
		timeout, err := time.ParseDuration(cfg.Timeout)
		if err != nil {
			return wrapLocalizedError("Root.Error.InvalidTimeout", "invalid timeout", err)
		}

		// Create auth manager
		authMgr, err = auth.NewManager(cfg.Token, cfg.Server)
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedCreateAuthManager", "failed to create auth manager", err)
		}

		// Create API client
		apiClient, err = api.NewClient(cfg.Server, timeout, authMgr.GetJar())
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedCreateAPIClient", "failed to create API client", err)
		}
		apiClient.SetClientIdentity("cli", "", authMgr.GetClientName())
		apiClient.SetAccessToken(authMgr.GetAccessToken())

		return nil
	},
}

// Execute runs the root command
func Execute() {
	prepareRootCommand(os.Args[1:])
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	cobra.OnInitialize(initLocalization)
	cobra.AddTemplateFunc("commandDisplayName", commandDisplayName)
	cobra.AddTemplateFunc("joinStrings", strings.Join)
	rootCmd.SetHelpTemplate(buildCommandHelpTemplate())
	rootCmd.SetUsageTemplate(buildCommandHelpTemplate())

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is ~/.config/niubility/config.yaml)")
	rootCmd.PersistentFlags().StringVar(&profileName, "profile", "", "isolated profile name for multi-server login")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "output", "o", "", "output format (table or json)")
	rootCmd.PersistentFlags().StringVar(&languageOption, "lang", "", "language for CLI messages (en or zh-CN)")
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	}
}

// isJSONOutput returns true if JSON output is requested
func isJSONOutput() bool {
	return outputFormat == "json" || (cfg != nil && cfg.Output == "json")
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

func commandDisplayName(cmd *cobra.Command) string {
	if len(cmd.Aliases) == 0 {
		return cmd.Name()
	}

	return fmt.Sprintf(
		"%s (%s: %s)",
		cmd.Name(),
		"aliases",
		strings.Join(cmd.Aliases, ", "),
	)
}

func initLocalization() {
	prepareRootCommand(nil)
}

func resolveLanguageOption() string {
	return resolveLanguagePreference(languageOption, profileName, cfgFile)
}

func resolveLanguagePreference(explicitLanguage, profile, configPath string) string {
	if explicitLanguage != "" {
		return explicitLanguage
	}

	if cfg != nil && cfg.Language != "" {
		return cfg.Language
	}

	loadedCfg, err := config.LoadProfile(profile, configPath)
	if err == nil && loadedCfg.Language != "" {
		return loadedCfg.Language
	}

	for _, envName := range []string{"LC_MESSAGES", "LANG"} {
		if value := strings.TrimSpace(os.Getenv(envName)); value != "" {
			return value
		}
	}

	return clii18n.DefaultLanguage
}

func prepareRootCommand(args []string) {
	language, profile, configPath := parseRuntimeOptions(args)
	clii18n.SetLanguage(resolveLanguagePreference(language, profile, configPath))

	rootCmd.SetHelpTemplate(buildCommandHelpTemplate())
	rootCmd.SetUsageTemplate(buildCommandHelpTemplate())
	localizeRootCommand()
	localizeAuthCommands()
	localizeCategoryCommands()
	localizeCommentCommands()
	localizeConfigCommands()
	localizeContentCommands()
	localizeFavoriteCommands()
	localizeFollowCommands()
	localizeLikeCommands()
	localizeProfileCommands()
	localizeSettingsCommands()
	localizeUserCommands()
	localizeBuiltinCobraText(rootCmd, true)
}

func buildCommandHelpTemplate() string {
	return fmt.Sprintf(`{{with (or .Long .Short)}}{{. | trimTrailingWhitespaces}}{{end}}

%s:
  {{if .Runnable}}{{.UseLine}}{{end}}{{if .HasAvailableSubCommands}}{{.CommandPath}} [command]{{end}}

{{if gt (len .Aliases) 0}}%s:
  {{joinStrings .Aliases ", "}}

{{end}}{{if .HasAvailableSubCommands}}%s:
{{range .Commands}}{{if (or .IsAvailableCommand (eq .Name "help"))}}  {{rpad (commandDisplayName .) 30 }} {{.Short}}
{{end}}{{end}}{{end}}{{if .HasAvailableLocalFlags}}%s:
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}
{{end}}{{if .HasAvailableInheritedFlags}}%s:
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}
{{end}}{{if .HasHelpSubCommands}}%s:
{{range .Commands}}{{if .IsAdditionalHelpTopicCommand}}  {{rpad (commandDisplayName .) 30 }} {{.Short}}
{{end}}{{end}}{{end}}{{if .HasAvailableSubCommands}}
%s "{{.CommandPath}} [command] --help" %s.
{{end}}`,
		clii18n.T("Help.Usage", "Usage", nil),
		"Aliases",
		clii18n.T("Help.AvailableCommands", "Available Commands", nil),
		clii18n.T("Help.Flags", "Flags", nil),
		clii18n.T("Help.GlobalFlags", "Global Flags", nil),
		clii18n.T("Help.AdditionalTopics", "Additional help topics", nil),
		clii18n.T("Help.Use", "Use", nil),
		clii18n.T("Help.MoreInfo", "for more information about a command", nil),
	)
}

func localizeRootCommand() {
	rootCmd.Short = clii18n.T("Root.Short", "CLI tool for Niubility platform", nil)
	rootCmd.Long = clii18n.T("Root.Long", rootCmd.Long, nil)

	if flag := rootCmd.PersistentFlags().Lookup("config"); flag != nil {
		flag.Usage = clii18n.T("Root.Flag.Config", "config file (default is ~/.config/niubility/config.yaml)", nil)
	}
	if flag := rootCmd.PersistentFlags().Lookup("profile"); flag != nil {
		flag.Usage = clii18n.T("Root.Flag.Profile", "isolated profile name for multi-server login", nil)
	}
	if flag := rootCmd.PersistentFlags().Lookup("output"); flag != nil {
		flag.Usage = clii18n.T("Root.Flag.Output", "output format (table or json)", nil)
	}
	if flag := rootCmd.PersistentFlags().Lookup("lang"); flag != nil {
		flag.Usage = clii18n.T("Root.Flag.Language", "language for CLI messages (en or zh-CN)", nil)
	}
}

func localizedError(id, fallback string) error {
	return fmt.Errorf("%s", localizedText(id, fallback, nil))
}

func wrapLocalizedError(id, fallback string, err error) error {
	return fmt.Errorf("%s: %w", localizedText(id, fallback, nil), err)
}

func localizedText(id, fallback string, data map[string]interface{}) string {
	return clii18n.T(id, fallback, data)
}

func printLocalizedField(id, fallback, value string) {
	fmt.Printf("%s: %s\n", localizedText(id, fallback, nil), value)
}

func printLocalizedMessage(id, fallback string, data map[string]interface{}) {
	fmt.Println(localizedText(id, fallback, data))
}

func printPagination(cursor string) {
	fmt.Printf("\n%s\n", localizedText(
		"Common.Message.MoreResults",
		"More results available. Use --cursor {{.Cursor}} to get next page.",
		map[string]interface{}{"Cursor": cursor},
	))
}

func printTotal(total int64) {
	fmt.Printf("\n%s\n", localizedText(
		"Common.Message.Total",
		"Total: {{.Count}}",
		map[string]interface{}{"Count": total},
	))
}

func localizedYesNo(value bool) string {
	if value {
		return localizedText("Common.Word.Yes", "yes", nil)
	}
	return localizedText("Common.Word.No", "no", nil)
}

func confirmAction(id, fallback string, data map[string]interface{}) bool {
	fmt.Print(localizedText(id, fallback, data))

	var response string
	if _, err := fmt.Scanln(&response); err != nil {
		response = ""
	}
	return isAffirmative(response)
}

func isAffirmative(response string) bool {
	switch strings.ToLower(strings.TrimSpace(response)) {
	case "y", "yes", "1", "true", "ok", "是":
		return true
	default:
		return false
	}
}

func isLocalOnlyCommand(cmd *cobra.Command) bool {
	for current := cmd; current != nil; current = current.Parent() {
		switch current.Name() {
		case "login", "config":
			return true
		}
	}

	return false
}

func parseRuntimeOptions(args []string) (language, profile, configPath string) {
	if len(args) == 0 {
		return "", profileName, cfgFile
	}

	for idx := 0; idx < len(args); idx++ {
		arg := args[idx]

		if value, ok := flagValue(arg, "--lang"); ok {
			language = value
			continue
		}
		if value, ok := flagValue(arg, "--profile"); ok {
			profile = value
			continue
		}
		if value, ok := flagValue(arg, "--config"); ok {
			configPath = value
			continue
		}

		switch arg {
		case "--lang":
			if idx+1 < len(args) {
				language = args[idx+1]
				idx++
			}
		case "--profile":
			if idx+1 < len(args) {
				profile = args[idx+1]
				idx++
			}
		case "--config":
			if idx+1 < len(args) {
				configPath = args[idx+1]
				idx++
			}
		}
	}

	if profile == "" {
		profile = profileName
	}
	if configPath == "" {
		configPath = cfgFile
	}

	return language, profile, configPath
}

func flagValue(arg, name string) (string, bool) {
	prefix := name + "="
	if !strings.HasPrefix(arg, prefix) {
		return "", false
	}
	return strings.TrimPrefix(arg, prefix), true
}

func localizeBuiltinCobraText(cmd *cobra.Command, initDefaults bool) {
	if cmd == nil {
		return
	}

	if initDefaults {
		cmd.InitDefaultHelpCmd()
		cmd.InitDefaultCompletionCmd()
	}
	cmd.InitDefaultHelpFlag()
	if flag := cmd.Flags().Lookup("help"); flag != nil {
		flag.Usage = localizedText("Help.Flag.Help", "help for {{.Command}}", map[string]interface{}{"Command": cmd.Name()})
	}

	for _, child := range cmd.Commands() {
		switch child.Name() {
		case "help":
			child.Short = localizedText("Help.Command.Short", "Help about any command", nil)
		case "completion":
			child.Short = localizedText("Help.Command.CompletionShort", "Generate the autocompletion script for the specified shell", nil)
		}
		localizeBuiltinCobraText(child, false)
	}
}
