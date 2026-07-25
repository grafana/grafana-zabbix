package cache

import (
	"sync"
	"time"
)

type TokenInfo struct {
	Token     string
	ExpiresAt time.Time
	UserID    string
	Username  string
}

type TokenCache struct {
	tokens sync.Map // key: "datasourceUID:identity"
}

func NewTokenCache() *TokenCache {
	return &TokenCache{}
}

func (tc *TokenCache) Get(datasourceUID, identity string) (*TokenInfo, bool) {
	key := datasourceUID + ":" + identity
	if val, ok := tc.tokens.Load(key); ok {
		tokenInfo := val.(*TokenInfo)
		if time.Now().Before(tokenInfo.ExpiresAt) {
			return tokenInfo, true
		}
		tc.tokens.Delete(key)
	}
	return nil, false
}

// Set caches a token keyed by (datasourceUID, identity). zabbixUserID is the
// Zabbix user id and is stored only for observability; it is not part of the key
// because it is unknown at Get time (before the Zabbix user lookup).
func (tc *TokenCache) Set(datasourceUID, identity, zabbixUserID, token string, ttl time.Duration) {
	key := datasourceUID + ":" + identity
	tokenInfo := &TokenInfo{
		Token:     token,
		ExpiresAt: time.Now().Add(ttl),
		UserID:    zabbixUserID,
		Username:  identity,
	}
	tc.tokens.Store(key, tokenInfo)
}

// CompareAndDelete removes the cached entry for (datasourceUID, identity) only
// if it still holds the given token. This prevents a request that got rejected
// with a stale token from evicting a fresh token that a concurrent request has
// already regenerated and cached.
func (tc *TokenCache) CompareAndDelete(datasourceUID, identity, token string) {
	key := datasourceUID + ":" + identity
	if val, ok := tc.tokens.Load(key); ok {
		if tokenInfo, ok := val.(*TokenInfo); ok && tokenInfo.Token == token {
			tc.tokens.Delete(key)
		}
	}
}

func (tc *TokenCache) CleanupExpired() int {
	count := 0
	tc.tokens.Range(func(key, value interface{}) bool {
		tokenInfo := value.(*TokenInfo)
		if time.Now().After(tokenInfo.ExpiresAt) {
			tc.tokens.Delete(key)
			count++
		}
		return true
	})
	return count

}
