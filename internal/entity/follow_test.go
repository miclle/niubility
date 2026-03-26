package entity

import (
	"testing"
)

func TestFollow_TableName(t *testing.T) {
	f := Follow{}
	if got := f.TableName(); got != "follows" {
		t.Errorf("TableName() = %q, want %q", got, "follows")
	}
}
