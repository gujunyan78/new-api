/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package service

import (
	"strings"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ExtractDomainHost extracts the request host from gin.Context, stripping the
// port. It mirrors the behavior of controller.GetStatus / GetAbout etc. so that
// domain-branding lookups behave consistently across endpoints.
func ExtractDomainHost(c *gin.Context) string {
	if c == nil || c.Request == nil {
		return ""
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	return strings.ToLower(strings.TrimSpace(host))
}

// ParseDomainGroupSet parses a comma separated csv list into a set.
// The second return value indicates whether the configuration is considered
// "configured" (i.e. has at least one non-empty entry).
func ParseDomainGroupSet(csv string) (map[string]struct{}, bool) {
	csv = strings.TrimSpace(csv)
	if csv == "" {
		return nil, false
	}
	set := make(map[string]struct{})
	for _, raw := range strings.Split(csv, ",") {
		v := strings.TrimSpace(raw)
		if v == "" {
			continue
		}
		set[v] = struct{}{}
	}
	if len(set) == 0 {
		return nil, false
	}
	return set, true
}

// GetDomainUsableGroupSet returns the configured usable-group whitelist for a
// given host. configured == false means the caller should NOT apply any domain
// level filtering (preserving the legacy / fallback behavior).
func GetDomainUsableGroupSet(host string) (map[string]struct{}, bool) {
	if host == "" {
		return nil, false
	}
	branding := model.GetCachedDomainBranding(host)
	if branding == nil {
		return nil, false
	}
	return ParseDomainGroupSet(branding.UsableGroups)
}

// GetDomainDefaultUserGroup returns the default User.Group configured for a
// given host. Empty string means "not configured" — callers should fall back
// to the model-level default.
func GetDomainDefaultUserGroup(host string) string {
	if host == "" {
		return ""
	}
	branding := model.GetCachedDomainBranding(host)
	if branding == nil {
		return ""
	}
	return strings.TrimSpace(branding.DefaultUserGroup)
}
