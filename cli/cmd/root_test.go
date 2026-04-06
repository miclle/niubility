package cmd

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestCategoryHelpShowsAliases(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"category", "list", "--help"})
	prepareRootCommand([]string{"category", "list", "--help"})

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "Aliases:\n  ls") {
		t.Fatalf("help output missing command aliases section:\n%s", helpOutput)
	}
}

func TestRootHelpCanBeLocalizedWithLangFlag(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"--lang", "zh-CN", "--help"})
	prepareRootCommand([]string{"--lang", "zh-CN", "--help"})

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "用法:") {
		t.Fatalf("help output missing localized usage header:\n%s", helpOutput)
	}
	if !strings.Contains(helpOutput, "CLI 文案语言（en 或 zh-CN）") {
		t.Fatalf("help output missing localized --lang flag description:\n%s", helpOutput)
	}
}

func TestRootHelpUsesEnvironmentLanguageFallback(t *testing.T) {
	t.Helper()

	oldLang, hadLang := os.LookupEnv("LANG")
	t.Cleanup(func() {
		if hadLang {
			_ = os.Setenv("LANG", oldLang)
			return
		}
		_ = os.Unsetenv("LANG")
	})

	if err := os.Setenv("LANG", "zh_CN.UTF-8"); err != nil {
		t.Fatalf("Setenv() error = %v", err)
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"--help"})
	prepareRootCommand([]string{"--help"})

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "可用命令:") {
		t.Fatalf("help output missing localized command header from LANG fallback:\n%s", helpOutput)
	}
}

func TestParentHelpShowsSubcommandAliases(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"category", "--help"})
	prepareRootCommand([]string{"category", "--help"})

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "list (aliases: ls)") {
		t.Fatalf("help output missing subcommand aliases:\n%s", helpOutput)
	}
	if !strings.Contains(helpOutput, "delete (aliases: rm)") {
		t.Fatalf("help output missing delete subcommand aliases:\n%s", helpOutput)
	}
}

func TestRootHelpShowsTopLevelAliases(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"--help"})
	prepareRootCommand([]string{"--help"})

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	expectedLines := []string{
		"category (aliases: cat)",
		"comment (aliases: cmt)",
		"content (aliases: cnt)",
		"favorite (aliases: fav)",
		"user (aliases: usr)",
	}

	for _, expected := range expectedLines {
		if !strings.Contains(helpOutput, expected) {
			t.Fatalf("help output missing top-level alias %q:\n%s", expected, helpOutput)
		}
	}
}
