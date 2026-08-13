package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// StartCodexOAuth initiates a Codex OAuth flow for global configuration.
func StartCodexOAuth(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "Codex OAuth flow is not implemented yet. Configure channel key JSON directly.",
		"success": false,
	})
}

// CompleteCodexOAuth completes a Codex OAuth flow for global configuration.
func CompleteCodexOAuth(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "Codex OAuth flow is not implemented yet. Configure channel key JSON directly.",
		"success": false,
	})
}

// StartCodexOAuthForChannel initiates a Codex OAuth flow for a specific channel.
func StartCodexOAuthForChannel(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "Codex OAuth flow is not implemented yet. Configure channel key JSON directly.",
		"success": false,
	})
}

// CompleteCodexOAuthForChannel completes a Codex OAuth flow for a specific channel.
func CompleteCodexOAuthForChannel(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"message": "Codex OAuth flow is not implemented yet. Configure channel key JSON directly.",
		"success": false,
	})
}
