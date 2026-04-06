package i18n

import (
	"embed"
	"fmt"
	"strings"
	"sync"

	goi18n "github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
	"gopkg.in/yaml.v3"
)

const (
	// DefaultLanguage is the fallback language for CLI messages.
	DefaultLanguage = "en"
	// SimplifiedChinese is the supported Simplified Chinese locale.
	SimplifiedChinese = "zh-CN"
)

var (
	supportedTags = []language.Tag{
		language.English,
		language.MustParse(SimplifiedChinese),
	}
	supportedCodes = []string{
		DefaultLanguage,
		SimplifiedChinese,
	}
	matcher = language.NewMatcher(supportedTags)
)

//go:embed locales/*.yaml
var localeFS embed.FS

var (
	bundle          *goi18n.Bundle
	localizer       *goi18n.Localizer
	currentLanguage = DefaultLanguage
	mu              sync.RWMutex
)

func init() {
	bundle = goi18n.NewBundle(language.English)
	bundle.RegisterUnmarshalFunc("yaml", yaml.Unmarshal)

	for _, path := range []string{
		"locales/active.en.yaml",
		"locales/active.zh-CN.yaml",
	} {
		if _, err := bundle.LoadMessageFileFS(localeFS, path); err != nil {
			panic(fmt.Sprintf("load locale file %s: %v", path, err))
		}
	}

	localizer = goi18n.NewLocalizer(bundle, DefaultLanguage)
}

// SetLanguage selects the active CLI language and returns the normalized code.
func SetLanguage(preferences ...string) string {
	lang := ResolveLanguage(preferences...)

	mu.Lock()
	defer mu.Unlock()

	currentLanguage = lang
	localizer = goi18n.NewLocalizer(bundle, lang)

	return currentLanguage
}

// CurrentLanguage returns the active normalized language code.
func CurrentLanguage() string {
	mu.RLock()
	defer mu.RUnlock()

	return currentLanguage
}

// ResolveLanguage returns the first supported language from preferences.
func ResolveLanguage(preferences ...string) string {
	for _, preference := range preferences {
		if lang, ok := NormalizeLanguage(preference); ok {
			return lang
		}
	}
	return DefaultLanguage
}

// NormalizeLanguage normalizes a raw language value into a supported code.
func NormalizeLanguage(raw string) (string, bool) {
	cleaned := sanitizeLanguage(raw)
	if cleaned == "" {
		return "", false
	}

	tag, err := language.Parse(cleaned)
	if err != nil {
		return "", false
	}

	_, index, confidence := matcher.Match(tag)
	if confidence == language.No {
		return "", false
	}

	if index < 0 || index >= len(supportedCodes) {
		return "", false
	}

	return supportedCodes[index], true
}

// T translates a message id with a default English fallback.
func T(id, fallback string, data map[string]interface{}) string {
	mu.RLock()
	l := localizer
	mu.RUnlock()

	if l == nil {
		return fallback
	}

	config := &goi18n.LocalizeConfig{
		DefaultMessage: &goi18n.Message{
			ID:    id,
			Other: fallback,
		},
	}
	if data != nil {
		config.TemplateData = data
	}

	message, err := l.Localize(config)
	if err != nil {
		return fallback
	}
	return message
}

func sanitizeLanguage(raw string) string {
	cleaned := strings.TrimSpace(raw)
	if cleaned == "" {
		return ""
	}

	if idx := strings.Index(cleaned, "."); idx >= 0 {
		cleaned = cleaned[:idx]
	}
	if idx := strings.Index(cleaned, "@"); idx >= 0 {
		cleaned = cleaned[:idx]
	}

	cleaned = strings.ReplaceAll(cleaned, "_", "-")
	return cleaned
}
