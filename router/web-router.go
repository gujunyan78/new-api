package router

import (
	"bytes"
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
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

// indexExcludingFS wraps a static.ServeFileSystem but reports the index page
// (root "/" and "index.html") as non-existent, so the static middleware does
// not serve it. This lets the NoRoute handler serve the index with per-domain
// analytics injected — which requires the request host (unavailable in Open).
type indexExcludingFS struct {
	inner static.ServeFileSystem
}

func (f *indexExcludingFS) Exists(prefix, path string) bool {
	clean := strings.TrimPrefix(path, prefix)
	clean = strings.Trim(clean, "/")
	if clean == "" || clean == "index.html" {
		return false
	}
	return f.inner.Exists(prefix, path)
}

func (f *indexExcludingFS) Open(name string) (http.File, error) {
	return f.inner.Open(name)
}

// excludePathsFS wraps a ServeFileSystem and reports the given paths as
// non-existent, so the static middleware passes through to explicit handlers
// (e.g. /robots.txt and /sitemap.xml which are generated/overridden at
// request time rather than served from the build output).
type excludePathsFS struct {
	inner static.ServeFileSystem
	paths map[string]bool
}

func (f *excludePathsFS) Exists(prefix, path string) bool {
	clean := strings.TrimPrefix(path, prefix)
	clean = strings.Trim(clean, "/")
	if f.paths[clean] {
		return false
	}
	return f.inner.Exists(prefix, path)
}

func (f *excludePathsFS) Open(name string) (http.File, error) {
	return f.inner.Open(name)
}

// injectAnalytics injects per-domain analytics (from DomainBranding) into an
// HTML document: HeaderAnalytics -> <head>, BodyAnalytics -> before </body>.
// host is the request host (may include a port).
func injectAnalytics(html []byte, host string) []byte {
	s := string(html)

	// Per-domain analytics configured in 域名品牌管理.
	if host != "" {
		if idx := strings.LastIndex(host, ":"); idx != -1 {
			host = host[:idx]
		}
		if branding := model.GetCachedDomainBranding(host); branding != nil {
			if branding.HeaderAnalytics != "" {
				s = injectHead(s, branding.HeaderAnalytics)
			}
			if branding.BodyAnalytics != "" {
				s = strings.Replace(s, "</body>", branding.BodyAnalytics+"\n</body>", 1)
			}
		}
	}

	return []byte(s)
}

// injectHead inserts analytics code into <head>. If the page still carries the
// <!--Google Analytics--> placeholder marker it is inserted right after it
// (early in head); otherwise it is appended just before </head>.
func injectHead(html, code string) string {
	const marker = "<!--Google Analytics-->"
	if strings.Contains(html, marker) {
		return strings.Replace(html, marker, code+"\n    "+marker, 1)
	}
	return strings.Replace(html, "</head>", code+"\n</head>", 1)
}

// analyticsResponseWriter buffers the response body so per-domain analytics
// can be injected just before the body is written to the client. The decision
// of whether to inject is deferred to flush(), where the final Content-Type
// header is available: gin calls WriteHeader() before a handler (e.g.
// c.Data) sets Content-Type, so inspecting it earlier would miss text/html
// responses and skip injection entirely.
type analyticsResponseWriter struct {
	gin.ResponseWriter
	host     string
	status   int
	wroteHdr bool
	buf      bytes.Buffer
}

func (w *analyticsResponseWriter) WriteHeader(code int) {
	if w.wroteHdr {
		return
	}
	w.status = code
	w.wroteHdr = true
	// Defer the actual write to flush(), where the final Content-Type is known
	// and per-domain analytics can be injected if the response is HTML.
}

func (w *analyticsResponseWriter) Write(b []byte) (int, error) {
	return w.buf.Write(b)
}

// flush injects analytics into a buffered HTML response and writes it out.
// Non-HTML responses are written through unchanged.
func (w *analyticsResponseWriter) flush() {
	if !w.wroteHdr {
		w.status = http.StatusOK
	}
	ct := w.Header().Get("Content-Type")
	if w.status == http.StatusOK && strings.Contains(ct, "text/html") {
		body := injectAnalytics(w.buf.Bytes(), w.host)
		w.ResponseWriter.WriteHeader(w.status)
		w.ResponseWriter.Write(body)
		return
	}
	w.ResponseWriter.WriteHeader(w.status)
	w.ResponseWriter.Write(w.buf.Bytes())
}

// analyticsInjector injects per-domain analytics (HeaderAnalytics / BodyAnalytics
// from 域名品牌管理) into every text/html response served by the web router, so
// all frontend pages — SPA routes and any other HTML documents — carry the
// configured tracking code.
func analyticsInjector() gin.HandlerFunc {
	return func(c *gin.Context) {
		w := &analyticsResponseWriter{ResponseWriter: c.Writer, host: c.Request.Host, status: http.StatusOK}
		c.Writer = w
		c.Next()
		w.flush()
	}
}

// sitemapPaths are the public, indexable routes of the classic web template.
// Auth-required console/* routes are intentionally excluded from the sitemap.
var sitemapPaths = []string{
	"/",
	"/about",
	"/user-agreement",
	"/privacy-policy",
	"/pricing",
	"/login",
	"/register",
	"/reset",
	"/user/reset",
	"/setup",
}

// customDomainFilePath resolves the path to a domain-specific custom file of
// the form "{domain}_{filename}" inside the current theme's custom directory.
// The port (if any) is stripped from the host. The returned path may not exist.
func customDomainFilePath(c *gin.Context, filename string) string {
	host := c.Request.Host
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	dir := "web/default/custom"
	if common.GetTheme() == "classic" {
		dir = "web/classic/custom"
	}
	return filepath.Join(dir, host+"_"+filename)
}

// serveCustomOrGenerated first tries to return a domain-specific custom file
// ({domain}_{filename}); if it does not exist, it falls back to content.
func serveCustomOrGenerated(c *gin.Context, filename, contentType string, generated func() []byte) {
	if p := customDomainFilePath(c, filename); fileExists(p) {
		c.File(p)
		return
	}
	c.Data(http.StatusOK, contentType, generated())
}

// fileExists reports whether the given path exists on the filesystem.
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

const defaultRobots = `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow:

Sitemap: /sitemap.xml
`

// robotsHandler returns the domain-specific {domain}_robots.txt if present,
// otherwise falls back to the default robots.txt with a sitemap reference.
func robotsHandler(c *gin.Context) {
	serveCustomOrGenerated(c, "robots.txt", "text/plain; charset=utf-8", func() []byte {
		return []byte(defaultRobots)
	})
}

// sitemapHandler returns the domain-specific {domain}_sitemap.xml if present,
// otherwise auto-generates a sitemap.xml based on the request host. This makes
// it work for any self-hosted domain without manual configuration.
func sitemapHandler(c *gin.Context) {
	serveCustomOrGenerated(c, "sitemap.xml", "application/xml; charset=utf-8", func() []byte {
		scheme := "https"
		if proto := c.GetHeader("X-Forwarded-Proto"); proto != "" {
			scheme = proto
		} else if c.Request.TLS == nil {
			scheme = "http"
		}
		base := scheme + "://" + c.Request.Host

		var b strings.Builder
		b.WriteString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
		b.WriteString("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n")
		for _, p := range sitemapPaths {
			b.WriteString("  <url>\n")
			b.WriteString("    <loc>" + base + p + "</loc>\n")
			b.WriteString("  </url>\n")
		}
		b.WriteString("</urlset>\n")
		return []byte(b.String())
	})
}

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	defaultFS := common.EmbedFolder(assets.DefaultBuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	// Inject per-domain analytics into every text/html response so all
	// frontend pages carry the configured tracking code.
	router.Use(analyticsInjector())
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())

	// Serve user-custom static resources from the filesystem (no auth required).
	// Files placed in web/{theme}/custom/ are accessible at /custom/*
	// Theme-aware: classic theme serves web/classic/custom, default serves web/default/custom.
	router.Use(static.Serve("/custom", &customStaticFS{
		defaultDir: "web/default/custom",
		classicDir: "web/classic/custom",
	}))

	router.Use(static.Serve("/", &excludePathsFS{
		inner: &indexExcludingFS{inner: themeFS},
		paths: map[string]bool{"robots.txt": true, "sitemap.xml": true},
	}))
	router.GET("/robots.txt", robotsHandler)
	router.GET("/sitemap.xml", sitemapHandler)
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
		c.Data(http.StatusOK, "text/html; charset=utf-8", base)
	})
}
