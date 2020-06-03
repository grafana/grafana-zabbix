package cache

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	cache "github.com/patrickmn/go-cache"
)

const (
	// For use with functions that take an expiration time.
	NoExpiration time.Duration = -1
	// For use with functions that take an expiration time. Equivalent to
	// passing in the same expiration duration as was given to New() or
	// NewFrom() when the cache was created (e.g. 5 minutes.)
	DefaultExpiration time.Duration = 0
)

// Cache is a abstraction over go-cache.
type Cache struct {
	cache *cache.Cache
}

// NewCache creates a go-cache with expiration(ttl) time and cleanupInterval.
func NewCache(ttl time.Duration, cleanupInterval time.Duration) *Cache {
	return &Cache{
		cache.New(ttl, cleanupInterval),
	}
}

// Set the value of the key "request" to "rersponse" with default expiration time.
func (c *Cache) Set(request string, response interface{}) {
	c.cache.SetDefault(request, response)
}

// Get the value associated with request from the cache
func (c *Cache) Get(request string) (interface{}, bool) {
	return c.cache.Get(request)
}

// HashString converts the given text string to hash string
func HashString(text string) string {
	hash := sha1.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}

// HashDatasourceInfo converts the given datasource info to hash string
func HashDatasourceInfo(dsInfo *backend.DataSourceInstanceSettings) string {
	digester := sha1.New()
	if err := json.NewEncoder(digester).Encode(dsInfo); err != nil {
		panic(err) // This shouldn't be possible but just in case DatasourceInfo changes
	}
	return hex.EncodeToString(digester.Sum(nil))
}
