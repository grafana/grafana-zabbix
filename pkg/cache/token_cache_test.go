package cache

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenCache_SetAndGet(t *testing.T) {
	tc := NewTokenCache()
	tc.Set("ds-uid", "alice", "alice", "token-abc", time.Hour)

	info, ok := tc.Get("ds-uid", "alice", "alice")
	require.True(t, ok, "expected to find cached token")
	assert.Equal(t, "token-abc", info.Token)
	assert.Equal(t, "alice", info.Username)
	assert.True(t, info.ExpiresAt.After(time.Now()), "ExpiresAt should be in the future")
}

func TestTokenCache_GetMissing(t *testing.T) {
	tc := NewTokenCache()

	_, ok := tc.Get("ds-uid", "nobody", "nobody")
	assert.False(t, ok, "expected miss for unknown identity")
}

func TestTokenCache_ExpiredEntryIsEvictedOnGet(t *testing.T) {
	tc := NewTokenCache()
	// Store an already-expired entry.
	tc.Set("ds-uid", "alice", "alice", "stale-token", -time.Minute)

	_, ok := tc.Get("ds-uid", "alice", "alice")
	assert.False(t, ok, "expired entry should not be returned")

	// And it should have been deleted, so a follow-up cleanup finds nothing.
	assert.Equal(t, 0, tc.CleanupExpired(), "expired entry should already be evicted by Get")
}

func TestTokenCache_IsolatedByDatasourceAndIdentity(t *testing.T) {
	tc := NewTokenCache()
	tc.Set("ds-1", "alice", "alice", "token-1", time.Hour)
	tc.Set("ds-2", "alice", "alice", "token-2", time.Hour)
	tc.Set("ds-1", "bob", "bob", "token-3", time.Hour)

	info, ok := tc.Get("ds-1", "alice", "alice")
	require.True(t, ok)
	assert.Equal(t, "token-1", info.Token, "must not leak token across datasources")

	info, ok = tc.Get("ds-2", "alice", "alice")
	require.True(t, ok)
	assert.Equal(t, "token-2", info.Token)

	info, ok = tc.Get("ds-1", "bob", "bob")
	require.True(t, ok)
	assert.Equal(t, "token-3", info.Token, "must not leak token across identities")
}

func TestTokenCache_CleanupExpired(t *testing.T) {
	tc := NewTokenCache()
	tc.Set("ds", "valid", "valid", "t1", time.Hour)
	tc.Set("ds", "expired-1", "expired-1", "t2", -time.Minute)
	tc.Set("ds", "expired-2", "expired-2", "t3", -time.Hour)

	cleaned := tc.CleanupExpired()
	assert.Equal(t, 2, cleaned, "should remove both expired entries")

	_, ok := tc.Get("ds", "valid", "valid")
	assert.True(t, ok, "valid entry should survive cleanup")
}
