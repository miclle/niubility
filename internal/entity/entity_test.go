package entity

import (
	"strings"
	"testing"
)

func TestID(t *testing.T) {
	id1 := ID()
	id2 := ID()

	// Check that IDs are not empty
	if id1 == "" {
		t.Error("ID() returned empty string")
	}
	if id2 == "" {
		t.Error("ID() returned empty string")
	}

	// Check that IDs are unique
	if id1 == id2 {
		t.Error("ID() returned duplicate IDs")
	}

	// Check UUID format (36 characters including 4 hyphens)
	if len(id1) != 36 {
		t.Errorf("ID() = %q, want 36 characters", id1)
	}

	// Check UUID format has hyphens in correct positions
	parts := strings.Split(id1, "-")
	if len(parts) != 5 {
		t.Errorf("ID() = %q, should have 5 parts separated by hyphens", id1)
	}
}

func TestPagination_GetLimit(t *testing.T) {
	tests := []struct {
		name     string
		limit    int
		want     int
		modified bool
	}{
		{"zero limit uses default", 0, 20, true},
		{"negative limit uses default", -1, 20, true},
		{"limit 10", 10, 10, false},
		{"limit 50", 50, 50, false},
		{"limit 100", 100, 100, false},
		{"limit over 100 caps to 100", 150, 100, true},
		{"limit 1", 1, 1, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Pagination{Limit: tt.limit}
			got := p.GetLimit()
			if got != tt.want {
				t.Errorf("GetLimit() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestEncodeCursor(t *testing.T) {
	tests := []struct {
		name   string
		fields []string
	}{
		{"single field", []string{"abc123"}},
		{"two fields", []string{"abc123", "2024-01-01"}},
		{"three fields", []string{"id", "timestamp", "status"}},
		{"field with special chars", []string{"id|with|pipes"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded := EncodeCursor(tt.fields...)
			if encoded == "" {
				t.Error("EncodeCursor() returned empty string")
			}
			// Verify it's valid base64 by decoding
			decoded, err := DecodeCursor(encoded, len(tt.fields))
			if err != nil {
				t.Errorf("DecodeCursor() error = %v", err)
				return
			}
			for i, f := range tt.fields {
				if decoded[i] != f {
					t.Errorf("decoded[%d] = %q, want %q", i, decoded[i], f)
				}
			}
		})
	}
}

func TestEncodeCursor_EmptyField(t *testing.T) {
	// Empty string should encode to empty base64
	encoded := EncodeCursor("")
	if encoded != "" {
		t.Errorf("EncodeCursor('') = %q, want empty string", encoded)
	}
}

func TestDecodeCursor(t *testing.T) {
	tests := []struct {
		name      string
		cursor    string
		count     int
		want      []string
		wantError bool
	}{
		{
			name:   "single field",
			cursor: EncodeCursor("test"),
			count:  1,
			want:   []string{"test"},
		},
		{
			name:   "two fields",
			cursor: EncodeCursor("id123", "2024-01-01"),
			count:  2,
			want:   []string{"id123", "2024-01-01"},
		},
		{
			name:      "invalid base64",
			cursor:    "not-valid-base64!!!",
			count:     1,
			wantError: true,
		},
		{
			name:      "wrong field count",
			cursor:    EncodeCursor("one", "two"),
			count:     3,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DecodeCursor(tt.cursor, tt.count)
			if tt.wantError {
				if err == nil {
					t.Error("DecodeCursor() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("DecodeCursor() error = %v", err)
				return
			}
			if len(got) != len(tt.want) {
				t.Errorf("DecodeCursor() got %d fields, want %d", len(got), len(tt.want))
				return
			}
			for i, v := range tt.want {
				if got[i] != v {
					t.Errorf("DecodeCursor()[%d] = %q, want %q", i, got[i], v)
				}
			}
		})
	}
}
