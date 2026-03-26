// Package errors provides centralized error message definitions.
package errors

import "net/http"

// Error represents an application error with status code and message.
type Error struct {
	Code    int
	Message string
}

// Error implements the error interface.
func (e *Error) Error() string {
	return e.Message
}

// Authentication errors.
var (
	// ErrInvalidCredentials indicates username or password is incorrect.
	ErrInvalidCredentials = &Error{Code: http.StatusUnauthorized, Message: "用户名或密码错误"}
	// ErrAccountInactive indicates the account is not activated.
	ErrAccountInactive = &Error{Code: http.StatusForbidden, Message: "账户未激活，请联系管理员"}
	// ErrRegistrationClosed indicates user registration is not enabled.
	ErrRegistrationClosed = &Error{Code: http.StatusForbidden, Message: "用户注册未开放"}
	// ErrPasswordTooShort indicates the password is too short.
	ErrPasswordTooShort = &Error{Code: http.StatusBadRequest, Message: "密码长度不能少于 6 位"}
	// ErrOldPasswordIncorrect indicates the old password is incorrect.
	ErrOldPasswordIncorrect = &Error{Code: http.StatusBadRequest, Message: "旧密码不正确"}
)
