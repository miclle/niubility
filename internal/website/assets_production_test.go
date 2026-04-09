package website

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/fox-gonic/fox"
)

func TestEmbedAssetsSupportsHeadForPages(t *testing.T) {
	t.Parallel()

	router := fox.New()
	EmbedAssets(router)

	tests := []struct {
		name string
		path string
	}{
		{name: "homepage", path: "/"},
		{name: "spa fallback", path: "/login"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodHead, tt.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("HEAD %s status = %d, want %d", tt.path, rec.Code, http.StatusOK)
			}

			contentType := rec.Header().Get("Content-Type")
			if !strings.HasPrefix(contentType, "text/html") {
				t.Fatalf("HEAD %s content-type = %q, want text/html", tt.path, contentType)
			}

			if cacheControl := rec.Header().Get("Cache-Control"); cacheControl != htmlCacheControl {
				t.Fatalf("HEAD %s cache-control = %q, want %q", tt.path, cacheControl, htmlCacheControl)
			}
		})
	}
}

func TestEmbedAssetsSupportsHeadForStaticAssets(t *testing.T) {
	t.Parallel()

	router := fox.New()
	EmbedAssets(router)

	entries, err := embedFS.ReadDir("build/assets")
	if err != nil {
		t.Fatalf("ReadDir(build/assets) error = %v", err)
	}

	var (
		jsPath  string
		cssPath string
	)

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		switch {
		case jsPath == "" && strings.HasSuffix(name, ".js"):
			jsPath = "/assets/" + name
		case cssPath == "" && strings.HasSuffix(name, ".css"):
			cssPath = "/assets/" + name
		}

		if jsPath != "" && cssPath != "" {
			break
		}
	}

	tests := []struct {
		name              string
		path              string
		wantContentPrefix string
	}{
		{name: "javascript asset", path: jsPath, wantContentPrefix: "text/javascript"},
		{name: "stylesheet asset", path: cssPath, wantContentPrefix: "text/css"},
	}

	for _, tt := range tests {
		if tt.path == "" {
			t.Fatalf("missing embedded asset for test case %q", tt.name)
		}

		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequest(http.MethodHead, tt.path, nil)
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("HEAD %s status = %d, want %d", tt.path, rec.Code, http.StatusOK)
			}

			contentType := rec.Header().Get("Content-Type")
			if !strings.HasPrefix(contentType, tt.wantContentPrefix) {
				t.Fatalf("HEAD %s content-type = %q, want prefix %q", tt.path, contentType, tt.wantContentPrefix)
			}

			if cacheControl := rec.Header().Get("Cache-Control"); cacheControl != assetCacheControl {
				t.Fatalf("HEAD %s cache-control = %q, want %q", tt.path, cacheControl, assetCacheControl)
			}
		})
	}
}
