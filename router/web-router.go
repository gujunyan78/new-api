package router

import (
	"bytes"
	"embed"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// ThemeAssets holds the embedded frontend assets for both themes.
type ThemeAssets struct {
	DefaultBuildFS   embed.FS
	DefaultIndexPage []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
}

// customStaticFS serves user-custom static resources from the filesystem,
// respecting the current theme (classic/default). No authentication required.
type customStaticFS struct {
	defaultDir string
	classicDir string
}

func (c *customStaticFS) Exists(prefix string, path string) bool {
	// Only handle paths that actually start with the prefix.
	// Without this check, a request for "/" would match because the
	// custom directory exists on disk, causing the static middleware to
	// abort with 404 before the NoRoute handler can serve the SPA index.
	if !strings.HasPrefix(path, prefix) {
		return false
	}
	dir := c.defaultDir
	if common.GetTheme() == "classic" {
		dir = c.classicDir
	}
	// Remove the prefix to get the relative file path
	p := strings.TrimPrefix(path, prefix)
	_, err := os.Stat(filepath.Join(dir, p))
	return err == nil
}

func (c *customStaticFS) Open(name string) (http.File, error) {
	// For root path, return error to pass through to NoRouter handler
	if name == "/" || name == "/custom" {
		return nil, os.ErrNotExist
	}

	dir := c.defaultDir
	if common.GetTheme() == "classic" {
		dir = c.classicDir
	}

	// Remove the /custom prefix if present
	path := strings.TrimPrefix(name, "/custom")
	path = strings.TrimPrefix(path, "/")

	filePath := filepath.Join(dir, path)

	// Check if path exists
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, os.ErrNotExist
	}

	// If it's a directory, return error to prevent directory listing
	if info.IsDir() {
		return nil, os.ErrNotExist
	}

	return os.Open(filePath)
}

// analyticsFileSystem wraps a static.ServeFileSystem and injects external
// analytics snippets into the served index.html at request time.
//
// Snippets are read from the theme's custom directory:
//   - web/{theme}/custom/analytics_head.html  -> inserted into <head>
//   - web/{theme}/custom/analytics_body.html  -> inserted before </body>
//
// Because injection happens on every request (cached by file mtime), changing
// the tracking scripts only requires editing those files on disk — no Go
// recompile and no frontend rebuild needed.
type analyticsFileSystem struct {
	inner       static.ServeFileSystem
	defaultBase []byte
	classicBase []byte
	cache       sync.Map // theme -> *cachedAnalytics
}

type cachedAnalytics struct {
	headData  []byte
	bodyData  []byte
	headMod   time.Time
	bodyMod   time.Time
	headFound bool
	bodyFound bool
	base      []byte
	baseMod   time.Time
}

func (a *analyticsFileSystem) Exists(prefix, path string) bool {
	return a.inner.Exists(prefix, path)
}

func (a *analyticsFileSystem) Open(name string) (http.File, error) {
	if filepath.Base(name) != "index.html" {
		return a.inner.Open(name)
	}
	theme := common.GetTheme()
	base := a.defaultBase
	if theme == "classic" {
		base = a.classicBase
	}
	rendered := renderIndexPage(a, theme, base)
	return &memFile{Reader: bytes.NewReader(rendered), name: "index.html", size: int64(len(rendered))}, nil
}

// snippetPaths returns the head/body snippet file paths for the given theme.
func snippetPaths(theme string) (head, body string) {
	dir := "web/default/custom"
	if theme == "classic" {
		dir = "web/classic/custom"
	}
	return filepath.Join(dir, "analytics_head.html"), filepath.Join(dir, "analytics_body.html")
}

// loadSnippet reads a snippet file, using an mtime-based cache so disk is only
// hit when the file changes.
func loadSnippet(path string, cached *cachedAnalytics, isHead bool) ([]byte, bool) {
	info, err := os.Stat(path)
	if err != nil {
		if isHead {
			cached.headFound = false
		} else {
			cached.bodyFound = false
		}
		return nil, false
	}
	if isHead {
		if cached.headFound && !info.ModTime().After(cached.headMod) {
			return cached.headData, true
		}
	} else {
		if cached.bodyFound && !info.ModTime().After(cached.bodyMod) {
			return cached.bodyData, true
		}
	}
	data, err := os.ReadFile(path)
	if err != nil || len(data) == 0 {
		if isHead {
			cached.headFound = false
		} else {
			cached.bodyFound = false
		}
		return nil, false
	}
	if isHead {
		cached.headData = data
		cached.headMod = info.ModTime()
		cached.headFound = true
	} else {
		cached.bodyData = data
		cached.bodyMod = info.ModTime()
		cached.bodyFound = true
	}
	return data, true
}

// renderIndexPage merges the base index.html with the external snippets.
func renderIndexPage(a *analyticsFileSystem, theme string, base []byte) []byte {
	cacheAny, _ := a.cache.LoadOrStore(theme, &cachedAnalytics{})
	cached := cacheAny.(*cachedAnalytics)
	if cached.baseMod.IsZero() || !sameBytes(cached.base, base) {
		cached.base = append([]byte(nil), base...)
		cached.baseMod = time.Now()
	}

	headPath, bodyPath := snippetPaths(theme)
	html := string(base)
	if head, ok := loadSnippet(headPath, cached, true); ok {
		marker := "<!--Google Analytics-->"
		if strings.Contains(html, marker) {
			html = strings.Replace(html, marker, string(head)+"\n    "+marker, 1)
		} else {
			html = strings.Replace(html, "</head>", string(head)+"\n</head>", 1)
		}
	}
	if body, ok := loadSnippet(bodyPath, cached, false); ok {
		html = strings.Replace(html, "</body>", string(body)+"\n</body>", 1)
	}
	return []byte(html)
}

func sameBytes(a, b []byte) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// memFile is an in-memory http.File used to serve the injected index.html.
type memFile struct {
	*bytes.Reader
	name string
	size int64
}

func (m *memFile) Close() error                       { return nil }
func (m *memFile) Readdir(int) ([]fs.FileInfo, error) { return nil, fs.ErrInvalid }
func (m *memFile) Stat() (fs.FileInfo, error)         { return &memFileInfo{name: m.name, size: m.size}, nil }

type memFileInfo struct {
	name string
	size int64
}

func (i *memFileInfo) Name() string       { return i.name }
func (i *memFileInfo) Size() int64        { return i.size }
func (i *memFileInfo) Mode() fs.FileMode  { return 0o444 }
func (i *memFileInfo) ModTime() time.Time { return time.Time{} }
func (i *memFileInfo) IsDir() bool        { return false }
func (i *memFileInfo) Sys() any           { return nil }

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	// Serve user-custom static resources from the filesystem (no auth required).
	// Files placed in web/{theme}/custom/ are accessible at /custom/*
	// Theme-aware: classic theme serves web/classic/custom, default serves web/default/custom.
	router.Use(static.Serve("/custom", &customStaticFS{
		defaultDir: "web/default/custom",
		classicDir: "web/classic/custom",
	}))

	analyticsFS := &analyticsFileSystem{
		inner:       themeFS,
		defaultBase: assets.DefaultIndexPage,
		classicBase: assets.ClassicIndexPage,
	}
	router.Use(static.Serve("/", analyticsFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		theme := common.GetTheme()
		base := assets.DefaultIndexPage
		if theme == "classic" {
			base = assets.ClassicIndexPage
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", renderIndexPage(analyticsFS, theme, base))
	})
}
