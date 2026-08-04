package zabbix

import (
	"crypto/sha1"
	"encoding/hex"
	"time"

	"github.com/alexanderzobnin/grafana-zabbix/pkg/cache"
)

var cachedMethods = map[string]bool{
	"hostgroup.get":   true,
	"host.get":        true,
	"application.get": true,
	"item.get":        true,
	"service.get":     true,
	"usermacro.get":   true,
	"proxy.get":       true,
	"valuemap.get":    true,
}

func IsCachedRequest(method string) bool {
	_, ok := cachedMethods[method]
	return ok
}

// ZabbixCache is a cache for datasource instance.
type ZabbixCache struct {
	cache *cache.Cache
}

// NewZabbixCache creates a DatasourceCache with expiration(ttl) time and cleanupInterval.
func NewZabbixCache(ttl time.Duration, cleanupInterval time.Duration) *ZabbixCache {
	return &ZabbixCache{
		cache.NewCache(ttl, cleanupInterval),
	}
}

// GetAPIRequest gets request response from cache. scope partitions the cache:
// per-user requests pass their auth token so responses fetched under one
// user's Zabbix permissions are never served to another user. Requests using
// the shared stored credentials pass an empty scope.
func (c *ZabbixCache) GetAPIRequest(scope string, request *ZabbixAPIRequest) (interface{}, bool) {
	requestHash := HashString(scope + ":" + request.String())
	return c.cache.Get(requestHash)
}

// SetAPIRequest writes request response to cache under the given scope.
func (c *ZabbixCache) SetAPIRequest(scope string, request *ZabbixAPIRequest, response interface{}) {
	requestHash := HashString(scope + ":" + request.String())
	c.cache.Set(requestHash, response)
}

// HashString converts the given text string to hash string
func HashString(text string) string {
	hash := sha1.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}
