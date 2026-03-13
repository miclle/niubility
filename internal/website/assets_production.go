//go:build !development

package website

import (
	"embed"
	"errors"
	"fmt"
	"html/template"
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/fox-gonic/fox"
	"github.com/fox-gonic/fox/httperrors"
	"github.com/fox-gonic/fox/render"
)

//go:embed build/*
var embedFS embed.FS

var assets []string

func init() {
	entries, err := embedFS.ReadDir("build")
	if err != nil {
		fmt.Printf("Fail to read build dir: %+v", err)
		os.Exit(1)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		fp := entry.Name()
		assets = append(assets, fp)
	}
}

// EmbedAssets serves the embedded SPA assets in production mode.
func EmbedAssets(router *fox.Engine) {
	tmpl := template.Must(template.New("").ParseFS(embedFS, "build/*.html"))

	homepage := render.HTML{
		Template: tmpl,
		Name:     "index.html",
		Data:     map[string]string{},
	}

	// handle home page
	router.GET("/", func(c *fox.Context) any {
		return homepage
	})

	// handle the assets files
	router.StaticFS("/assets", StaticFS("build/assets"))

	for _, asset := range assets {
		router.StaticFileFS(asset, path.Join("build", asset), http.FS(embedFS))
	}

	router.NotFound(func(c *fox.Context) any {
		if c.Request.Method != http.MethodGet {
			return http.StatusNotFound
		}

		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			return httperrors.ErrNotFound
		}

		filepath := "public" + c.Request.URL.Path

		file, err := embedFS.Open(filepath)
		if errors.Is(err, fs.ErrNotExist) {
			return homepage
		}

		info, err := file.Stat()
		if err != nil {
			return err
		}

		return render.Reader{
			ContentLength: info.Size(),
			Reader:        file,
		}
	})
}

// resource is an interface that provides static file.
type resource struct {
	prefix string
	fs     embed.FS
}

// Open implements the interface required by http.FS.
func (r *resource) Open(name string) (fs.File, error) {
	name = path.Join(r.prefix, name)
	return r.fs.Open(name)
}

// StaticFS returns a static http file system from the embedded FS.
func StaticFS(prefix string) http.FileSystem {
	return http.FS(&resource{prefix: prefix, fs: embedFS})
}
