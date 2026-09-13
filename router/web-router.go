package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded frontend assets for both themes.
type WebAssets struct {
	BuildFS          embed.FS
	IndexPage        []byte
	ClassicBuildFS   embed.FS
	ClassicIndexPage []byte
}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	defaultFS := common.EmbedFolder(assets.BuildFS, "web/default/dist")
	classicFS := common.EmbedFolder(assets.ClassicBuildFS, "web/classic/dist")
	themeFS := common.NewThemeAwareFS(defaultFS, classicFS)

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		gzip.Gzip(gzip.DefaultCompression),
		middleware.AccessTokenAudit(),
		middleware.GlobalWebRateLimit(),
		middleware.Cache(),
		static.Serve("/", themeFS),
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			c.Header("Cache-Control", "no-cache")
			if common.GetTheme() == "classic" {
				c.Data(http.StatusOK, "text/html; charset=utf-8", assets.ClassicIndexPage)
			} else {
				c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
			}
		},
	)
}
