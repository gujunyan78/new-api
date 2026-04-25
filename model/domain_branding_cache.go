package model

import (
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	domainBrandingCache   map[string]*DomainBranding
	domainBrandingRWMutex sync.RWMutex
)

const domainBrandingRedisPrefix = "domain_branding:"

// InitDomainBrandingCache loads all domain branding configs from DB into memory cache at startup.
func InitDomainBrandingCache() {
	brandings, err := GetAllDomainBrandings()
	if err != nil {
		common.SysError("failed to load domain branding cache: " + err.Error())
		domainBrandingRWMutex.Lock()
		domainBrandingCache = make(map[string]*DomainBranding)
		domainBrandingRWMutex.Unlock()
		return
	}

	newCache := make(map[string]*DomainBranding, len(brandings))
	for _, b := range brandings {
		newCache[b.Domain] = b
	}

	domainBrandingRWMutex.Lock()
	domainBrandingCache = newCache
	domainBrandingRWMutex.Unlock()

	common.SysLog(fmt.Sprintf("domain branding cache initialized with %d entries", len(newCache)))
}

// GetCachedDomainBranding retrieves domain branding config with three-level lookup: memory → Redis → DB.
// Returns nil if no config exists for the given domain.
func GetCachedDomainBranding(domain string) *DomainBranding {
	// 1. Memory cache
	domainBrandingRWMutex.RLock()
	if b, ok := domainBrandingCache[domain]; ok {
		domainBrandingRWMutex.RUnlock()
		return b
	}
	domainBrandingRWMutex.RUnlock()

	// 2. Redis cache (if enabled)
	if common.RedisEnabled {
		redisKey := domainBrandingRedisPrefix + domain
		val, err := common.RedisGet(redisKey)
		if err == nil && val != "" {
			var b DomainBranding
			if err := common.Unmarshal([]byte(val), &b); err == nil {
				domainBrandingRWMutex.Lock()
				domainBrandingCache[domain] = &b
				domainBrandingRWMutex.Unlock()
				return &b
			}
		}
	}

	// 3. Database
	b, err := GetDomainBrandingByDomain(domain)
	if err != nil {
		return nil
	}

	// Populate memory cache
	domainBrandingRWMutex.Lock()
	domainBrandingCache[domain] = b
	domainBrandingRWMutex.Unlock()

	// Populate Redis cache
	if common.RedisEnabled {
		setDomainBrandingRedis(domain, b)
	}

	return b
}

// RefreshDomainBrandingCache reloads all domain branding configs from DB into memory and rebuilds Redis entries.
func RefreshDomainBrandingCache() {
	brandings, err := GetAllDomainBrandings()
	if err != nil {
		common.SysError("failed to refresh domain branding cache: " + err.Error())
		return
	}

	// Clear old Redis keys
	if common.RedisEnabled {
		domainBrandingRWMutex.RLock()
		for domain := range domainBrandingCache {
			_ = common.RedisDel(domainBrandingRedisPrefix + domain)
		}
		domainBrandingRWMutex.RUnlock()
	}

	newCache := make(map[string]*DomainBranding, len(brandings))
	for _, b := range brandings {
		newCache[b.Domain] = b
		if common.RedisEnabled {
			setDomainBrandingRedis(b.Domain, b)
		}
	}

	domainBrandingRWMutex.Lock()
	domainBrandingCache = newCache
	domainBrandingRWMutex.Unlock()
}

// InvalidateDomainBrandingCache removes a specific domain's cache entry from both memory and Redis.
func InvalidateDomainBrandingCache(domain string) {
	domainBrandingRWMutex.Lock()
	delete(domainBrandingCache, domain)
	domainBrandingRWMutex.Unlock()

	if common.RedisEnabled {
		_ = common.RedisDel(domainBrandingRedisPrefix + domain)
	}
}

func setDomainBrandingRedis(domain string, b *DomainBranding) {
	data, err := common.Marshal(b)
	if err != nil {
		common.SysError("failed to marshal domain branding for Redis: " + err.Error())
		return
	}
	ttl := time.Duration(common.SyncFrequency) * time.Second
	err = common.RedisSet(domainBrandingRedisPrefix+domain, string(data), ttl)
	if err != nil {
		common.SysError("failed to set domain branding in Redis: " + err.Error())
	}
}
