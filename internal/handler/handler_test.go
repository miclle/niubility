package handler

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// testEnv bundles the dependencies shared across handler tests.
type testEnv struct {
	ctrl   *Ctrl
	engine *fox.Engine
	svc    *service.Service
	db     *gorm.DB
}

// setupTestEnv creates a Ctrl backed by an in-memory SQLite service
// and a fox.Engine with all routes registered.
func setupTestEnv(t *testing.T) *testEnv {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}

	if err := db.AutoMigrate(
		&entity.User{},
		&entity.UserSession{},
		&entity.Content{},
		&entity.Attachment{},
		&entity.Setting{},
		&entity.Department{},
		&entity.Comment{},
		&entity.Like{},
		&entity.Category{},
		&entity.Follow{},
		&entity.Favorite{},
		&entity.ContentView{},
		&entity.BackupRecord{},
		&entity.ServiceNode{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	svc := service.NewTestService(db)

	ctrl := New(svc)
	engine := fox.New()
	ctrl.RegisterRoutes(engine)

	return &testEnv{ctrl: ctrl, engine: engine, svc: svc, db: db}
}

// createTestUser inserts a user into the test database.
func (te *testEnv) createTestUser(t *testing.T, user *entity.User) {
	t.Helper()
	if user.ID == "" {
		user.ID = entity.ID()
	}
	if user.Status == "" {
		user.Status = entity.UserStatusActivated
	}
	if err := te.db.Create(user).Error; err != nil {
		t.Fatalf("create test user: %v", err)
	}
}

// markInitialized marks the system as initialized so auth middleware lets API calls through.
func (te *testEnv) markInitialized(t *testing.T) {
	t.Helper()
	if err := te.svc.SetSetting(context.Background(), entity.SettingInitialized, "true"); err != nil {
		t.Fatalf("mark initialized: %v", err)
	}
}

// issueTestToken creates a signed JWT for the given user (with a valid session).
func (te *testEnv) issueTestToken(t *testing.T, user *entity.User) string {
	t.Helper()
	ctx := context.Background()

	expiresAt := time.Now().Add(24 * time.Hour)
	session, err := te.svc.CreateUserSession(ctx, user.ID, expiresAt, service.SessionAuditInfo{
		ClientType: entity.ClientTypeWeb,
		UserAgent:  "test-agent",
		IPAddress:  "127.0.0.1",
	})
	if err != nil {
		t.Fatalf("create test session: %v", err)
	}

	claims := AuthClaims{
		SessionID:  session.ID,
		ClientType: entity.ClientTypeWeb,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    user.Username,
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(te.svc.GetJWTSecret()))
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}
	return signed
}

// authCookie returns an http.Cookie for the given JWT token.
func authCookie(token string) *http.Cookie {
	return &http.Cookie{Name: CookieName, Value: token}
}

// doRequest performs an HTTP request against the test engine and returns the recorder.
func (te *testEnv) doRequest(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	te.engine.ServeHTTP(rec, req)
	return rec
}

// decodeJSON decodes JSON response body into the target.
func decodeJSON(t *testing.T, body io.Reader, target any) {
	t.Helper()
	if err := json.NewDecoder(body).Decode(target); err != nil {
		t.Fatalf("decode JSON: %v", err)
	}
}

// strPtr returns a pointer to the given string.
func strPtr(s string) *string { return &s }

// rolePtr returns a pointer to the given Role.
func rolePtr(r entity.Role) *entity.Role { return &r }
