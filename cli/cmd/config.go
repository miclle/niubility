// Package cmd provides CLI commands
package cmd

import (
	"fmt"

	"github.com/miclle/niubility/cli/internal/config"
	clii18n "github.com/miclle/niubility/cli/internal/i18n"
	"github.com/miclle/niubility/cli/internal/output"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage local CLI configuration",
	Long: `Manage local CLI configuration stored on this machine.

Use this command to persist preferences such as the default CLI language.`,
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show local CLI configuration",
	Long: `Show the local CLI configuration for the current profile.

Sensitive values such as tokens are not printed directly.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := config.LoadProfile(profileName, cfgFile)
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedLoadConfig", "failed to load config", err)
		}

		configPath := config.ResolveConfigPath(profileName, cfgFile)
		tokenPresent := cfg.Token != ""

		if isJSONOutput() {
			return output.NewPrinter(output.FormatJSON).PrintJSON(map[string]interface{}{
				"profile":        profileName,
				"config_path":    configPath,
				"server":         cfg.Server,
				"output":         cfg.Output,
				"editor":         cfg.Editor,
				"default_status": cfg.DefaultStatus,
				"timeout":        cfg.Timeout,
				"language":       cfg.Language,
				"token_present":  tokenPresent,
			})
		}

		printLocalizedField("Common.Label.ConfigPath", "Config Path", configPath)
		if profileName != "" {
			printLocalizedField("Common.Label.Profile", "Profile", profileName)
		}
		printLocalizedField("Common.Label.Server", "Server", cfg.Server)
		printLocalizedField("Common.Label.OutputFormat", "Output", cfg.Output)
		printLocalizedField("Common.Label.Editor", "Editor", cfg.Editor)
		printLocalizedField("Common.Label.DefaultStatus", "Default Status", cfg.DefaultStatus)
		printLocalizedField("Common.Label.Timeout", "Timeout", cfg.Timeout)
		printLocalizedField("Common.Label.Language", "Language", cfg.Language)
		printLocalizedField("Common.Label.TokenStored", "Token Stored", localizedYesNo(tokenPresent))

		return nil
	},
}

var configSetLanguageCmd = &cobra.Command{
	Use:     "set-language <language>",
	Aliases: []string{"set-lang"},
	Short:   "Persist the default CLI language",
	Long: `Persist the default CLI language into the local config file.

Supported values:
  en
  zh-CN

Examples:
  niubility config set-language zh-CN
  niubility --profile prod config set-language en`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		normalized, ok := clii18n.NormalizeLanguage(args[0])
		if !ok {
			return fmt.Errorf("%s", localizedText(
				"Config.Command.SetLanguage.Error.InvalidLanguage",
				"language must be 'en' or 'zh-CN', got '{{.Value}}'",
				map[string]interface{}{"Value": args[0]},
			))
		}

		cfg, err := config.LoadProfile(profileName, cfgFile)
		if err != nil {
			return wrapLocalizedError("Root.Error.FailedLoadConfig", "failed to load config", err)
		}

		cfg.Language = normalized
		if err := config.SaveProfile(profileName, cfg, cfgFile); err != nil {
			return wrapLocalizedError("Config.Command.SetLanguage.Error.SaveFailed", "failed to save config", err)
		}

		clii18n.SetLanguage(normalized)

		output.PrintSuccessT(
			"Config.Command.SetLanguage.Success.Saved",
			"CLI language saved as {{.Language}}",
			map[string]interface{}{"Language": normalized},
		)
		printLocalizedField("Common.Label.Language", "Language", normalized)
		if profileName != "" {
			printLocalizedField("Common.Label.Profile", "Profile", profileName)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configSetLanguageCmd)
}

func localizeConfigCommands() {
	configCmd.Short = clii18n.T("Config.Command.Short", "Manage local CLI configuration", nil)
	configCmd.Long = clii18n.T("Config.Command.Long", configCmd.Long, nil)

	configShowCmd.Short = clii18n.T("Config.Command.Show.Short", "Show local CLI configuration", nil)
	configShowCmd.Long = clii18n.T("Config.Command.Show.Long", configShowCmd.Long, nil)

	configSetLanguageCmd.Short = clii18n.T("Config.Command.SetLanguage.Short", "Persist the default CLI language", nil)
	configSetLanguageCmd.Long = clii18n.T("Config.Command.SetLanguage.Long", configSetLanguageCmd.Long, nil)
}
