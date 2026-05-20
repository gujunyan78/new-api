package router

import (
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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

	router.Use(static.Serve("/", themeFS))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-cache")
		if common.GetTheme() == "classic" {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.ClassicIndexPage)
		} else {
			c.Data(http.StatusOK, "text/html; charset=utf-8", assets.DefaultIndexPage)
		}
	})
}
