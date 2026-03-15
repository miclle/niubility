// Package sec provides a Secret type that masks sensitive values in logs and JSON output.
package sec

import "encoding/json"

// Secret wraps a string value to prevent accidental exposure in logs or JSON output.
type Secret string

// Value returns the underlying secret value.
func (s Secret) Value() string {
	return string(s)
}

// String returns a masked representation for safe logging.
func (s Secret) String() string {
	if len(s) == 0 {
		return ""
	}
	return "******"
}

// MarshalJSON implements json.Marshaler to mask the value in JSON output.
func (s Secret) MarshalJSON() ([]byte, error) {
	return json.Marshal(s.String())
}

// UnmarshalJSON implements json.Unmarshaler to properly unmarshal the secret.
func (s *Secret) UnmarshalJSON(data []byte) error {
	var str string
	if err := json.Unmarshal(data, &str); err != nil {
		return err
	}
	*s = Secret(str)
	return nil
}

// UnmarshalText implements encoding.TextUnmarshaler for YAML/JSON string decoding.
func (s *Secret) UnmarshalText(text []byte) error {
	*s = Secret(text)
	return nil
}
