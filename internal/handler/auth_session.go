package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/fox-gonic/fox"
	"github.com/golang-jwt/jwt/v5"

	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/service"
)

const (
	clientCookieName       = "NIUBILITY_CLIENT"
	clientTypeHeader       = "X-Niubility-Client-Type"
	clientIDHeader         = "X-Niubility-Client-ID"
	clientNameHeader       = "X-Niubility-Client-Name"
	defaultSessionDuration = 30 * 24 * time.Hour
)

// AuthClaims extends JWT registered claims with session audit metadata.
type AuthClaims struct {
	SessionID  string            `json:"sid,omitempty"`
	ClientType entity.ClientType `json:"ctp,omitempty"`
	ClientID   string            `json:"cid,omitempty"`
	jwt.RegisteredClaims
}

type requestClientInfo struct {
	ClientType entity.ClientType
	ClientID   string
	ClientName string
	UserAgent  string
	IPAddress  string
}

func (ctrl *Ctrl) issueToken(user *entity.User, session *entity.UserSession) (string, error) {
	timeNow := time.Now()
	expiresAt := timeNow.Add(defaultSessionDuration)

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, AuthClaims{
		SessionID:  session.ID,
		ClientType: session.ClientType,
		ClientID:   session.ClientID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    user.Username,
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(timeNow),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	})

	return jwtToken.SignedString([]byte(ctrl.service.GetJWTSecret()))
}

func (ctrl *Ctrl) startUserSession(c *fox.Context, user *entity.User) (string, error) {
	clientInfo := ctrl.ensureRequestClientInfo(c)
	expiresAt := time.Now().Add(defaultSessionDuration)
	session, err := ctrl.service.CreateUserSession(c.Request.Context(), user.ID, expiresAt, service.SessionAuditInfo{
		ClientType: clientInfo.ClientType,
		ClientID:   clientInfo.ClientID,
		ClientName: clientInfo.ClientName,
		UserAgent:  clientInfo.UserAgent,
		IPAddress:  clientInfo.IPAddress,
	})
	if err != nil {
		return "", err
	}

	return ctrl.issueToken(user, session)
}

func (ctrl *Ctrl) ensureRequestClientInfo(c *fox.Context) requestClientInfo {
	info := ctrl.requestClientInfo(c.Request)
	if info.ClientID == "" {
		info.ClientID = randomClientID()
		if info.ClientType == entity.ClientTypeWeb {
			ctrl.setClientIDCookie(c, info.ClientID)
		}
	}
	return info
}

func (ctrl *Ctrl) requestClientInfo(req *http.Request) requestClientInfo {
	info := requestClientInfo{
		ClientType: entity.ClientTypeWeb,
		ClientID:   strings.TrimSpace(req.Header.Get(clientIDHeader)),
		ClientName: strings.TrimSpace(req.Header.Get(clientNameHeader)),
		UserAgent:  strings.TrimSpace(req.UserAgent()),
		IPAddress:  requestIP(req),
	}

	if strings.EqualFold(strings.TrimSpace(req.Header.Get(clientTypeHeader)), string(entity.ClientTypeCLI)) {
		info.ClientType = entity.ClientTypeCLI
	} else if cookie, err := req.Cookie(clientCookieName); err == nil {
		info.ClientID = strings.TrimSpace(cookie.Value)
	}

	return info
}

func (ctrl *Ctrl) setClientIDCookie(c *fox.Context, clientID string) {
	if clientID == "" {
		return
	}

	secure := ctrl.service.IsCookieSecure(c.Request.Context())
	cookie := &http.Cookie{
		Name:     clientCookieName,
		Value:    clientID,
		Path:     "/",
		MaxAge:   int(defaultSessionDuration / time.Second),
		Secure:   secure,
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
	}
	if secure {
		cookie.SameSite = http.SameSiteNoneMode
	}

	http.SetCookie(c.Writer, cookie)
}

func (ctrl *Ctrl) parseAuthClaimsFromRequest(req *http.Request) (*AuthClaims, error) {
	tokenString := requestAuthToken(req)
	if tokenString == "" {
		return nil, http.ErrNoCookie
	}

	claims := &AuthClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		return []byte(ctrl.service.GetJWTSecret()), nil
	})
	if err != nil {
		return nil, err
	}
	return claims, nil
}

func requestAuthToken(req *http.Request) string {
	authHeader := strings.TrimSpace(req.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	if cookie, err := req.Cookie(CookieName); err == nil {
		return cookie.Value
	}
	return ""
}

func requestIP(req *http.Request) string {
	if req == nil {
		return ""
	}

	if forwardedFor := strings.TrimSpace(req.Header.Get("X-Forwarded-For")); forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	if realIP := strings.TrimSpace(req.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(req.RemoteAddr))
	if err == nil {
		return host
	}

	return strings.TrimSpace(req.RemoteAddr)
}

func randomClientID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return entity.ID()
	}
	return hex.EncodeToString(buf)
}
