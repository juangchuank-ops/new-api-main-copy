package common

import "sync"

// 渠道并发计数：key 为计数维度 ——
// 渠道级为 "c:<channelId>"，模型级为 "m:<channelId>:<model>"。
// 计数释放归零后立即从 map 中移除，避免长时间运行后 map 无界增长。
var channelConcurrencyState = struct {
	mu     sync.Mutex
	active map[string]int64
}{active: make(map[string]int64)}

// AcquireChannelConcurrency 尝试占用一个并发槽位。
// limit <= 0 表示不限制，直接放行。返回 false 表示已达上限。
func AcquireChannelConcurrency(key string, limit int) bool {
	if limit <= 0 {
		return true
	}
	channelConcurrencyState.mu.Lock()
	defer channelConcurrencyState.mu.Unlock()
	if channelConcurrencyState.active[key] >= int64(limit) {
		return false
	}
	channelConcurrencyState.active[key]++
	return true
}

// ReleaseChannelConcurrency 释放一个并发槽位，必须与成功的 Acquire 一一配对。
func ReleaseChannelConcurrency(key string) {
	channelConcurrencyState.mu.Lock()
	defer channelConcurrencyState.mu.Unlock()
	remaining := channelConcurrencyState.active[key] - 1
	if remaining <= 0 {
		delete(channelConcurrencyState.active, key)
		return
	}
	channelConcurrencyState.active[key] = remaining
}
