// Package output provides output formatting utilities
package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/olekukonko/tablewriter"
)

// Format represents output format
type Format string

const (
	FormatTable Format = "table"
	FormatJSON  Format = "json"
)

// Printer handles output formatting
type Printer struct {
	// format is the output format
	format Format

	// writer is the output writer
	writer io.Writer
}

// NewPrinter creates a new printer
func NewPrinter(format Format) *Printer {
	return &Printer{
		format: format,
		writer: os.Stdout,
	}
}

// SetFormat sets the output format
func (p *Printer) SetFormat(format Format) {
	p.format = format
}

// Print prints data in the configured format
func (p *Printer) Print(data interface{}) error {
	if p.format == FormatJSON {
		return p.PrintJSON(data)
	}
	return nil // Table printing is handled by specific methods
}

// PrintJSON prints data as JSON
func (p *Printer) PrintJSON(data interface{}) error {
	encoder := json.NewEncoder(p.writer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}

// PrintError prints an error message to stderr
func PrintError(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, "Error: "+format+"\n", args...)
}

// PrintSuccess prints a success message to stdout
func PrintSuccess(format string, args ...interface{}) {
	fmt.Printf("✓ "+format+"\n", args...)
}

// PrintInfo prints an info message to stdout
func PrintInfo(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
}

// Table represents a table for output
type Table struct {
	headers []string
	rows    [][]string
	writer  io.Writer
}

// NewTable creates a new table
func NewTable(headers ...string) *Table {
	return &Table{
		headers: headers,
		rows:    make([][]string, 0),
		writer:  os.Stdout,
	}
}

// AddRow adds a row to the table
func (t *Table) AddRow(cols ...string) {
	t.rows = append(t.rows, cols)
}

// Print prints the table
func (t *Table) Print() {
	table := tablewriter.NewWriter(t.writer)
	table.SetHeader(t.headers)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetCenterSeparator("")
	table.SetColumnSeparator("")
	table.SetRowSeparator("")
	table.SetHeaderLine(false)
	table.SetBorder(false)
	table.SetTablePadding("\t")
	table.SetNoWhiteSpace(true)

	for _, row := range t.rows {
		table.Append(row)
	}

	table.Render()
}

// Truncate truncates a string to max length
func Truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	if maxLen <= 3 {
		return s[:maxLen]
	}
	return s[:maxLen-3] + "..."
}

// StatusIcon returns an icon for status
func StatusIcon(status string) string {
	switch strings.ToLower(status) {
	case "published":
		return "●"
	case "draft":
		return "○"
	default:
		return "?"
	}
}

// FormatTime formats a time string for display
func FormatTime(s string) string {
	if s == "" {
		return "-"
	}
	// Try to parse RFC3339 format
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return s
	}
	return t.Format("2006-01-02 15:04")
}
