package entity

import (
	"testing"
)

func TestDepartment_TableName(t *testing.T) {
	d := Department{}
	if got := d.TableName(); got != "departments" {
		t.Errorf("TableName() = %q, want %q", got, "departments")
	}
}
