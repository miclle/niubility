package entity

import (
	"testing"
)

func TestCategory_TableName(t *testing.T) {
	c := Category{}
	if got := c.TableName(); got != "categories" {
		t.Errorf("TableName() = %q, want %q", got, "categories")
	}
}
