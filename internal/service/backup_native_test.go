package service

import (
	"testing"
	"time"
)

func TestFormatSQLValue(t *testing.T) {
	tests := []struct {
		name    string
		value   any
		dialect string
		want    string
	}{
		{name: "nil/postgres", value: nil, dialect: "postgres", want: "NULL"},
		{name: "nil/mysql", value: nil, dialect: "mysql", want: "NULL"},
		{name: "bool true/postgres", value: true, dialect: "postgres", want: "TRUE"},
		{name: "bool false/postgres", value: false, dialect: "postgres", want: "FALSE"},
		{name: "bool true/mysql", value: true, dialect: "mysql", want: "1"},
		{name: "bool false/mysql", value: false, dialect: "mysql", want: "0"},
		{name: "int64", value: int64(42), dialect: "postgres", want: "42"},
		{name: "float64", value: float64(3.14), dialect: "postgres", want: "3.14"},
		{name: "string simple", value: "hello", dialect: "postgres", want: "'hello'"},
		{name: "string with quote/postgres", value: "it's", dialect: "postgres", want: "'it''s'"},
		{name: "string with quote/mysql", value: "it's", dialect: "mysql", want: `'it\'s'`},
		{name: "string with backslash/mysql", value: `a\b`, dialect: "mysql", want: `'a\\b'`},
		{name: "time", value: time.Date(2026, 4, 15, 10, 30, 0, 0, time.UTC), dialect: "postgres", want: "'2026-04-15 10:30:00'"},
		{name: "bytes text", value: []byte("hello"), dialect: "postgres", want: "'hello'"},
		{name: "bytes binary/postgres", value: []byte{0x00, 0xFF}, dialect: "postgres", want: `E'\x00ff'`},
		{name: "bytes binary/mysql", value: []byte{0x00, 0xFF}, dialect: "mysql", want: "X'00ff'"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatSQLValue(tt.value, tt.dialect)
			if got != tt.want {
				t.Errorf("formatSQLValue(%v, %q) = %q, want %q", tt.value, tt.dialect, got, tt.want)
			}
		})
	}
}

func TestEscapeSQLString(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		dialect string
		want    string
	}{
		{name: "plain/postgres", input: "hello", dialect: "postgres", want: "'hello'"},
		{name: "single quote/postgres", input: "it's", dialect: "postgres", want: "'it''s'"},
		{name: "single quote/mysql", input: "it's", dialect: "mysql", want: `'it\'s'`},
		{name: "backslash/mysql", input: `a\b`, dialect: "mysql", want: `'a\\b'`},
		{name: "backslash/postgres", input: `a\b`, dialect: "postgres", want: `'a\b'`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := escapeSQLString(tt.input, tt.dialect)
			if got != tt.want {
				t.Errorf("escapeSQLString(%q, %q) = %q, want %q", tt.input, tt.dialect, got, tt.want)
			}
		})
	}
}

func TestQuoteIdentifier(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		dialect string
		want    string
	}{
		{name: "postgres", input: "users", dialect: "postgres", want: `"users"`},
		{name: "mysql", input: "users", dialect: "mysql", want: "`users`"},
		{name: "postgres escape", input: `my"table`, dialect: "postgres", want: `"my""table"`},
		{name: "mysql escape", input: "my`table", dialect: "mysql", want: "`my``table`"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := quoteIdentifier(tt.dialect, tt.input)
			if got != tt.want {
				t.Errorf("quoteIdentifier(%q, %q) = %q, want %q", tt.dialect, tt.input, got, tt.want)
			}
		})
	}
}

func TestPgColumnType(t *testing.T) {
	tests := []struct {
		name      string
		dataType  string
		udtName   string
		charMaxLn *int64
		want      string
	}{
		{name: "varchar with length", dataType: "character varying", udtName: "varchar", charMaxLn: ptrInt64(255), want: "varchar(255)"},
		{name: "varchar no length", dataType: "character varying", udtName: "varchar", charMaxLn: nil, want: "varchar"},
		{name: "integer", dataType: "integer", udtName: "int4", charMaxLn: nil, want: "integer"},
		{name: "text", dataType: "text", udtName: "text", charMaxLn: nil, want: "text"},
		{name: "user-defined", dataType: "USER-DEFINED", udtName: "citext", charMaxLn: nil, want: "citext"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := pgColumnType(tt.dataType, tt.udtName, tt.charMaxLn)
			if got != tt.want {
				t.Errorf("pgColumnType(%q, %q, %v) = %q, want %q", tt.dataType, tt.udtName, tt.charMaxLn, got, tt.want)
			}
		})
	}
}

func TestIsPrintableText(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  bool
	}{
		{name: "plain ascii", input: []byte("hello"), want: true},
		{name: "with null byte", input: []byte{0x68, 0x00, 0x69}, want: false},
		{name: "utf8", input: []byte("你好"), want: true},
		{name: "invalid utf8", input: []byte{0x80, 0x81, 0x82}, want: false},
		{name: "empty", input: []byte{}, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isPrintableText(tt.input)
			if got != tt.want {
				t.Errorf("isPrintableText(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestMakeRowScanDest(t *testing.T) {
	dest := makeRowScanDest(3)
	if len(dest) != 3 {
		t.Fatalf("makeRowScanDest(3) len = %d, want 3", len(dest))
	}
	for i, d := range dest {
		if d == nil {
			t.Errorf("dest[%d] is nil, want non-nil *any", i)
		}
	}
}

// ptrInt64 is a test helper that returns a pointer to an int64.
func ptrInt64(n int64) *int64 {
	return &n
}
