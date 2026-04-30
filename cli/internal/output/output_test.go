package output

import (
	"bytes"
	"strings"
	"testing"
)

func TestTablePrintRendersHeadersAndRowsWithoutBorders(t *testing.T) {
	var buf bytes.Buffer
	table := NewTable("ID", "Title")
	table.writer = &buf
	table.AddRow("1", "Hello")

	table.Print()

	got := buf.String()
	for _, want := range []string{"ID", "TITLE", "1", "Hello"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected rendered table to contain %q, got %q", want, got)
		}
	}
	if strings.ContainsAny(got, "+-|│┌┐└┘") {
		t.Fatalf("expected rendered table to omit border characters, got %q", got)
	}
}
