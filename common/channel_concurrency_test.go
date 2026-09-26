package common

import (
	"sync"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAcquireChannelConcurrencyHonoursLimit(t *testing.T) {
	key := "test:acquire-limit"
	t.Cleanup(func() { ReleaseChannelConcurrency(key) })

	require.True(t, AcquireChannelConcurrency(key, 2), "first slot should be granted")
	require.True(t, AcquireChannelConcurrency(key, 2), "second slot should be granted")
	assert.False(t, AcquireChannelConcurrency(key, 2), "third slot must be rejected")

	ReleaseChannelConcurrency(key)
	assert.True(t, AcquireChannelConcurrency(key, 2), "released slot should be reusable")
	assert.False(t, AcquireChannelConcurrency(key, 2), "limit still applies after reuse")

	ReleaseChannelConcurrency(key)
	ReleaseChannelConcurrency(key)
	assert.True(t, AcquireChannelConcurrency(key, 2), "capacity is fully restored once every slot is released")
	ReleaseChannelConcurrency(key)
}

func TestAcquireChannelConcurrencyWithoutLimitAlwaysPasses(t *testing.T) {
	key := "test:no-limit"
	t.Cleanup(func() { ReleaseChannelConcurrency(key) })

	for i := 0; i < 100; i++ {
		require.True(t, AcquireChannelConcurrency(key, 0), "limit 0 means unlimited")
		require.True(t, AcquireChannelConcurrency(key, -1), "negative limit means unlimited")
	}

	channelConcurrencyState.mu.Lock()
	_, tracked := channelConcurrencyState.active[key]
	channelConcurrencyState.mu.Unlock()
	assert.False(t, tracked, "unlimited keys must not be tracked")
}

func TestAcquireChannelConcurrencyKeysAreIndependent(t *testing.T) {
	channelKey := "test:independent:c:1"
	modelKey := "test:independent:m:1:gpt-4o"
	t.Cleanup(func() {
		ReleaseChannelConcurrency(channelKey)
		ReleaseChannelConcurrency(modelKey)
	})

	require.True(t, AcquireChannelConcurrency(channelKey, 1))
	assert.True(t, AcquireChannelConcurrency(modelKey, 1), "a model-level slot is not governed by the channel-level slot")
	assert.False(t, AcquireChannelConcurrency(channelKey, 1))

	ReleaseChannelConcurrency(channelKey)
	assert.True(t, AcquireChannelConcurrency(channelKey, 1))
}

func TestReleaseChannelConcurrencyIgnoresUnknownKey(t *testing.T) {
	key := "test:unknown-key"

	require.NotPanics(t, func() { ReleaseChannelConcurrency(key) })

	channelConcurrencyState.mu.Lock()
	_, tracked := channelConcurrencyState.active[key]
	channelConcurrencyState.mu.Unlock()
	assert.False(t, tracked, "releasing an unknown key must not create a negative counter")

	assert.True(t, AcquireChannelConcurrency(key, 1), "full capacity remains available")
	ReleaseChannelConcurrency(key)
}

func TestAcquireChannelConcurrencyNeverExceedsLimit(t *testing.T) {
	const (
		key       = "test:race"
		limit     = 7
		goroutine = 64
	)

	var granted atomic.Int64
	var start sync.WaitGroup
	var done sync.WaitGroup
	start.Add(1)
	done.Add(goroutine)
	for i := 0; i < goroutine; i++ {
		go func() {
			defer done.Done()
			start.Wait()
			if AcquireChannelConcurrency(key, limit) {
				granted.Add(1)
			}
		}()
	}
	start.Done()
	done.Wait()
	t.Cleanup(func() {
		channelConcurrencyState.mu.Lock()
		delete(channelConcurrencyState.active, key)
		channelConcurrencyState.mu.Unlock()
	})

	assert.Equal(t, int64(limit), granted.Load(), "exactly the configured number of slots may be handed out")
}
