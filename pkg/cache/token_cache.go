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
	tokens sync.Map // key: "datasourceUID:identity:userID"
}

func NewTokenCache() *TokenCache {
	return &TokenCache{}
}

func (tc *TokenCache) Get(datasourceUID, identity, userID string) (*TokenInfo, bool) {
	key := datasourceUID + ":" + identity + ":" + userID
	if val, ok := tc.tokens.Load(key); ok {
		tokenInfo := val.(*TokenInfo)
		if time.Now().Before(tokenInfo.ExpiresAt) {
			return tokenInfo, true
		}
		tc.tokens.Delete(key)
	}
	return nil, false
}

func (tc *TokenCache) Set(datasourceUID, identity, userID, token string, ttl time.Duration) {
	key := datasourceUID + ":" + identity + ":" + userID
	tokenInfo := &TokenInfo{
		Token:     token,
		ExpiresAt: time.Now().Add(ttl),
		UserID:    userID,
		Username:  identity,
	}
	tc.tokens.Store(key, tokenInfo)
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
