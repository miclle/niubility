package cmd

import (
	"bytes"
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

	err := rootCmd.Execute()
	if err != nil {
		t.Fatalf("rootCmd.Execute() error = %v", err)
	}

	helpOutput := stdout.String() + stderr.String()
	if !strings.Contains(helpOutput, "Aliases:\n  ls") {
		t.Fatalf("help output missing command aliases section:\n%s", helpOutput)
	}
}

func TestParentHelpShowsSubcommandAliases(t *testing.T) {
	t.Helper()

	var stdout bytes.Buffer
	var stderr bytes.Buffer

	rootCmd.SetOut(&stdout)
	rootCmd.SetErr(&stderr)
	rootCmd.SetArgs([]string{"category", "--help"})

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
