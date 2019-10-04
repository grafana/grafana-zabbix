package main

import (
	"crypto/sha1"
	"encoding/hex"
	"time"

	cache "github.com/patrickmn/go-cache"
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

// Hash converts the given text string to hash string
func Hash(text string) string {
	hash := sha1.New()
	hash.Write([]byte(text))
	return hex.EncodeToString(hash.Sum(nil))
}
