package sec

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestSecretStringMasked(t *testing.T) {
	s := Secret("my-secret")
	if got := s.String(); got != "******" {
		t.Errorf("String() = %q, want ******", got)
	}
	if got := fmt.Sprint(s); got != "******" {
		t.Errorf("fmt.Sprint() = %q, want ******", got)
	}
}

func TestSecretValueReturnsRaw(t *testing.T) {
	s := Secret("my-secret")
	if got := s.Value(); got != "my-secret" {
		t.Errorf("Value() = %q, want my-secret", got)
	}
}

func TestSecretEmpty(t *testing.T) {
	s := Secret("")
	if got := s.Value(); got != "" {
		t.Errorf("Value() = %q, want empty", got)
	}
	if got := s.String(); got != "******" {
		t.Errorf("String() = %q, want ******", got)
	}
}

func TestSecretJSONMarshal(t *testing.T) {
	s := Secret("my-secret")
	b, err := json.Marshal(s)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	if string(b) != `"******"` {
		t.Errorf("json.Marshal() = %s, want \"******\"", b)
	}

	type Payload struct {
		Token Secret `json:"token"`
	}
	p := Payload{Token: s}
	b, err = json.Marshal(p)
	if err != nil {
		t.Fatalf("json.Marshal struct failed: %v", err)
	}
	want := `{"token":"******"}`
	if string(b) != want {
		t.Errorf("json.Marshal struct = %s, want %s", b, want)
	}

	// Empty value should also serialize as masked
	p2 := Payload{Token: Secret("")}
	b, err = json.Marshal(p2)
	if err != nil {
		t.Fatalf("json.Marshal empty failed: %v", err)
	}
	if string(b) != want {
		t.Errorf("json.Marshal empty = %s, want %s", b, want)
	}
}

func TestSecretJSONUnmarshal(t *testing.T) {
	var s Secret
	if err := json.Unmarshal([]byte(`"my-secret"`), &s); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if got := s.Value(); got != "my-secret" {
		t.Errorf("Value() = %q, want my-secret", got)
	}
	if got := s.String(); got != "******" {
		t.Errorf("String() = %q, want ******", got)
	}

	// Empty string
	if err := json.Unmarshal([]byte(`""`), &s); err != nil {
		t.Fatalf("json.Unmarshal empty failed: %v", err)
	}
	if got := s.Value(); got != "" {
		t.Errorf("Value() = %q, want empty", got)
	}
	if got := s.String(); got != "******" {
		t.Errorf("String() = %q, want ******", got)
	}
}

func TestSecretJSONUnmarshalStruct(t *testing.T) {
	type Cfg struct {
		Token Secret `json:"token"`
	}
	var cfg Cfg
	if err := json.Unmarshal([]byte(`{"token":"my-secret"}`), &cfg); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if got := cfg.Token.Value(); got != "my-secret" {
		t.Errorf("Token.Value() = %q, want my-secret", got)
	}
	if got := cfg.Token.String(); got != "******" {
		t.Errorf("Token.String() = %q, want ******", got)
	}

	// Empty string
	if err := json.Unmarshal([]byte(`{"token":""}`), &cfg); err != nil {
		t.Fatalf("json.Unmarshal empty failed: %v", err)
	}
	if got := cfg.Token.Value(); got != "" {
		t.Errorf("Token.Value() = %q, want empty", got)
	}
	if got := cfg.Token.String(); got != "******" {
		t.Errorf("Token.String() = %q, want ******", got)
	}
}
