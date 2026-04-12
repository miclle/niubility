// Package sec provides a sensitive string type `Secret` that hides real values in logs and output.
//
// Behavior:
//   - String(): Returns fixed mask "******" to avoid leaking sensitive info in logs (implements fmt.Stringer).
//   - MarshalJSON(): Outputs "\"******\"" during JSON serialization to prevent direct leakage.
//   - Value(): Returns the underlying raw string, only called when passing plaintext to downstream systems.
//   - Unmarshal: Since `Secret`'s underlying type is string, json.Unmarshal and yaml.Unmarshal
//     can directly decode strings to `Secret`; but subsequent String()/log output still shows mask.
//
// Usage notes:
//   - Avoid using fmt.Sprint/fmt.Sprintf to format `Secret` when plaintext is needed:
//     these functions call String() and return masked string, which may cause business logic errors.
//   - Avoid direct json.Marshal on `Secret` or structs containing `Secret` when plaintext is needed:
//     due to MarshalJSON() implementation, serialized result will be masked string.
//   - Correct approach: explicitly call Value() to get string when plaintext is needed for computation
//     or serialization; if struct needs plaintext output, define as string field and use s.Value() on assignment.
package sec

// Secret represents a sensitive string. Default printing and JSON serialization are masked to avoid leakage.
// Use Value() to safely retrieve the original value when needed.
type Secret string

// String returns a masked placeholder to prevent sensitive values from leaking in logs and output.
func (s Secret) String() string {
	return "******"
}

// Value returns the underlying raw string for cases where the plaintext is required.
func (s Secret) Value() string {
	return string(s)
}

// MarshalJSON returns a masked JSON string to prevent sensitive values from leaking during serialization.
func (s Secret) MarshalJSON() ([]byte, error) {
	return []byte("\"******\""), nil
}
