package entity

import (
	"testing"
)

func TestFavorite_TableName(t *testing.T) {
	f := Favorite{}
	if got := f.TableName(); got != "favorites" {
		t.Errorf("TableName() = %q, want %q", got, "favorites")
	}
}
