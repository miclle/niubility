package errors

import (
	"net/http"
	"testing"
)

func TestError_Error(t *testing.T) {
	tests := []struct {
		name    string
		err     *Error
		wantMsg string
	}{
		{
			name:    "ErrInvalidCredentials",
			err:     ErrInvalidCredentials,
			wantMsg: "用户名或密码错误",
		},
		{
			name:    "ErrAccountInactive",
			err:     ErrAccountInactive,
			wantMsg: "账户未激活，请联系管理员",
		},
		{
			name:    "ErrRegistrationClosed",
			err:     ErrRegistrationClosed,
			wantMsg: "用户注册未开放",
		},
		{
			name:    "ErrPasswordTooShort",
			err:     ErrPasswordTooShort,
			wantMsg: "密码长度不能少于 6 位",
		},
		{
			name:    "ErrOldPasswordIncorrect",
			err:     ErrOldPasswordIncorrect,
			wantMsg: "旧密码不正确",
		},
		{
			name:    "custom error",
			err:     &Error{Code: http.StatusInternalServerError, Message: "internal error"},
			wantMsg: "internal error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.wantMsg {
				t.Errorf("Error() = %q, want %q", got, tt.wantMsg)
			}
		})
	}
}

func TestError_Code(t *testing.T) {
	tests := []struct {
		name     string
		err      *Error
		wantCode int
	}{
		{
			name:     "ErrInvalidCredentials is Unauthorized",
			err:      ErrInvalidCredentials,
			wantCode: http.StatusUnauthorized,
		},
		{
			name:     "ErrAccountInactive is Forbidden",
			err:      ErrAccountInactive,
			wantCode: http.StatusForbidden,
		},
		{
			name:     "ErrRegistrationClosed is Forbidden",
			err:      ErrRegistrationClosed,
			wantCode: http.StatusForbidden,
		},
		{
			name:     "ErrPasswordTooShort is BadRequest",
			err:      ErrPasswordTooShort,
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "ErrOldPasswordIncorrect is BadRequest",
			err:      ErrOldPasswordIncorrect,
			wantCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Code; got != tt.wantCode {
				t.Errorf("Code = %d, want %d", got, tt.wantCode)
			}
		})
	}
}

func TestError_NilComparison(t *testing.T) {
	// Test that error variables are properly initialized
	if ErrInvalidCredentials == nil {
		t.Error("ErrInvalidCredentials should not be nil")
	}
	if ErrAccountInactive == nil {
		t.Error("ErrAccountInactive should not be nil")
	}
	if ErrRegistrationClosed == nil {
		t.Error("ErrRegistrationClosed should not be nil")
	}
	if ErrPasswordTooShort == nil {
		t.Error("ErrPasswordTooShort should not be nil")
	}
	if ErrOldPasswordIncorrect == nil {
		t.Error("ErrOldPasswordIncorrect should not be nil")
	}
}
