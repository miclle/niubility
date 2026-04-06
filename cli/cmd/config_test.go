package cmd

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/miclle/niubility/cli/internal/config"
)

func TestConfigSetLanguagePersistsNormalizedLanguage(t *testing.T) {
	t.Helper()

	configPath := t.TempDir() + "/config.yaml"

	previousCfgFile := cfgFile
	previousProfileName := profileName
	previousLanguageOption := languageOption
	t.Cleanup(func() {
		cfgFile = previousCfgFile
		profileName = previousProfileName
		languageOption = previousLanguageOption
	})

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	args := []string{"--config", configPath, "config", "set-language", "zh_CN.UTF-8"}
	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs(args)
	prepareRootCommand(args)

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	loaded, err := config.LoadFrom(configPath)
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if loaded.Language != "zh-CN" {
		t.Fatalf("Language = %q, want %q", loaded.Language, "zh-CN")
	}
}

func TestConfigSetLangAliasPersistsLanguage(t *testing.T) {
	t.Helper()

	configPath := t.TempDir() + "/config.yaml"

	previousCfgFile := cfgFile
	previousProfileName := profileName
	previousLanguageOption := languageOption
	t.Cleanup(func() {
		cfgFile = previousCfgFile
		profileName = previousProfileName
		languageOption = previousLanguageOption
	})

	args := []string{"--config", configPath, "config", "set-lang", "en"}
	rootCmd.SetArgs(args)
	prepareRootCommand(args)

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	loaded, err := config.LoadFrom(configPath)
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if loaded.Language != "en" {
		t.Fatalf("Language = %q, want %q", loaded.Language, "en")
	}
}

func TestConfigSetLanguageLocalizedHelp(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	args := []string{"--lang", "zh-CN", "config", "--help"}
	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs(args)
	prepareRootCommand(args)

	if err := rootCmd.Execute(); err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "可以用这个命令持久化默认 CLI 语言等偏好设置。") {
		t.Fatalf("help output missing localized config command description:\n%s", helpOutput)
	}
	if !strings.Contains(helpOutput, "set-language") {
		t.Fatalf("help output missing set-language subcommand:\n%s", helpOutput)
	}
}

func TestConfigShowPrintsMaskedConfigSummary(t *testing.T) {
	t.Helper()

	configPath := filepath.Join(t.TempDir(), "config.yaml")
	cfg := &config.Config{
		Server:        "http://localhost:9000",
		Output:        "json",
		Editor:        "vim",
		DefaultStatus: "published",
		Timeout:       "45s",
		Language:      "zh-CN",
		Token:         "secret-token",
	}
	if err := config.SaveTo(cfg, configPath); err != nil {
		t.Fatalf("SaveTo() error = %v", err)
	}

	previousCfgFile := cfgFile
	previousProfileName := profileName
	previousLanguageOption := languageOption
	previousOutputFormat := outputFormat
	t.Cleanup(func() {
		cfgFile = previousCfgFile
		profileName = previousProfileName
		languageOption = previousLanguageOption
		outputFormat = previousOutputFormat
	})

	args := []string{"--config", configPath, "config", "show"}
	rootCmd.SetArgs(args)
	prepareRootCommand(args)

	output := captureStdout(t, func() {
		if err := rootCmd.Execute(); err != nil {
			t.Fatalf("rootCmd.Execute() error = %v", err)
		}
	})

	if !strings.Contains(output, configPath) {
		t.Fatalf("config show output missing config path:\n%s", output)
	}
	if !strings.Contains(output, "语言: zh-CN") {
		t.Fatalf("config show output missing language:\n%s", output)
	}
	if !strings.Contains(output, "已保存 Token: 是") {
		t.Fatalf("config show output missing masked token status:\n%s", output)
	}
	if strings.Contains(output, "secret-token") {
		t.Fatalf("config show output leaked token value:\n%s", output)
	}
}

func captureStdout(t *testing.T, fn func()) string {
	t.Helper()

	oldStdout := os.Stdout
	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe() error = %v", err)
	}

	os.Stdout = writer
	defer func() {
		os.Stdout = oldStdout
	}()

	fn()

	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close() error = %v", err)
	}

	output, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	return string(output)
}
