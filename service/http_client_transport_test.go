package service

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaykitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

// http_client_transport_test.go — P3-Bridge HTTP transport policy 单测。
// 覆盖：未配置→旧版行为；HTTP/1.1；HTTP/2 shards；代理；异常；
// 以及实际 HTTP 请求链路（httptest 端到端，含 HTTP/2 ALPN 协商）。

func init() {
	// 确保 httpClient 已初始化（GetHttpClientWithProxy 依赖）。
	if GetHttpClient() == nil {
		InitHttpClient()
	}
}

func transportOf(t *testing.T, client *http.Client) *http.Transport {
	t.Helper()
	rt := client.Transport
	if rt == nil {
		t.Fatalf("client.Transport is nil")
	}
	// shardedRoundTripper 不是 *http.Transport，单 transport 路径才是。
	tr, ok := rt.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport, got %T", rt)
	}
	return tr
}

// --- 默认 policy → 走旧版，行为零变化 ---

func TestGetHttpClientWithProxyPolicy_DefaultDelegatesToOld(t *testing.T) {
	ResetPolicyProxyClientCache()
	def := defaultHTTPTransportPolicy()
	// 无代理 + 默认 policy → 应返回旧版 GetHttpClient() 同一实例
	c, err := GetHttpClientWithProxyPolicy("", def)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if c != GetHttpClient() {
		t.Errorf("default policy no-proxy should return the legacy httpClient pointer, got different client")
	}

	// 有代理 + 默认 policy → 应返回旧版 GetHttpClientWithProxy 的客户端
	cp, err := GetHttpClientWithProxyPolicy("http://127.0.0.1:0", def)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	old, err := GetHttpClientWithProxy("http://127.0.0.1:0")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if cp != old {
		t.Errorf("default policy with proxy should return the legacy proxy client pointer")
	}
}

// --- HTTP/1.1 policy ---

func TestGetHttpClientWithProxyPolicy_HTTP1Force(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}
	c, err := GetHttpClientWithProxyPolicy("", policy)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	tr := transportOf(t, c)
	if tr.ForceAttemptHTTP2 {
		t.Errorf("http1 policy must set ForceAttemptHTTP2=false")
	}
	if tr.TLSNextProto == nil {
		t.Errorf("http1 policy must set non-nil empty TLSNextProto to block h2")
	}
	if len(tr.TLSNextProto) != 0 {
		t.Errorf("http1 policy TLSNextProto must be empty map, got %d entries", len(tr.TLSNextProto))
	}
}

// --- HTTP/2 shards ---

func TestGetHttpClientWithProxyPolicy_HTTP2Shards(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolAuto, Shards: 4}
	c, err := GetHttpClientWithProxyPolicy("", policy)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	srt, ok := c.Transport.(*shardedRoundTripper)
	if !ok {
		t.Fatalf("shards>1 should wrap transport in shardedRoundTripper, got %T", c.Transport)
	}
	if srt.n != 4 {
		t.Errorf("expected 4 shards, got %d", srt.n)
	}
	if len(srt.shards) != 4 {
		t.Errorf("expected 4 shard transports, got %d", len(srt.shards))
	}
	// 每个 shard 应保留 HTTP/2 自动协商
	for i, rt := range srt.shards {
		tr, ok := rt.(*http.Transport)
		if !ok {
			t.Fatalf("shard[%d] not *http.Transport: %T", i, rt)
		}
		if !tr.ForceAttemptHTTP2 {
			t.Errorf("shard[%d] should keep ForceAttemptHTTP2=true for auto policy", i)
		}
	}
}

// --- HTTP2 shards=1 (auto+1) 等同默认 → 旧版单 transport ---

func TestGetHttpClientWithProxyPolicy_AutoShards1IsDefault(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolAuto, Shards: 1}
	if policy != defaultHTTPTransportPolicy() {
		t.Fatalf("auto+1 should equal default policy")
	}
	c, err := GetHttpClientWithProxyPolicy("", policy)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if c != GetHttpClient() {
		t.Errorf("auto+1 (default) should delegate to legacy httpClient")
	}
}

// --- http1 + shards>1：http1 强制 shards=1（policy 归一化在 NormalizeHTTPTransportPolicy 完成）---
// 这里直接构造已归一化的 policy（http1 → shards=1）验证不进入 sharded 路径。

func TestGetHttpClientWithProxyPolicy_HTTP1CollapsesShards(t *testing.T) {
	ResetPolicyProxyClientCache()
	// 模拟 NormalizeHTTPTransportPolicy 对 http1+shards 的归一化结果
	normalized := NormalizeHTTPTransportPolicy(relaykitdto.ChannelSettings{
		HTTPProtocol:          relaykitdto.HTTPProtocolHTTP1,
		HTTP2ConnectionShards: 4, // http1 下应被归一化为 1
	})
	if normalized.Shards != 1 {
		t.Fatalf("http1 policy should normalize shards to 1, got %d", normalized.Shards)
	}
	c, err := GetHttpClientWithProxyPolicy("", normalized)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if _, ok := c.Transport.(*shardedRoundTripper); ok {
		t.Errorf("http1 (shards=1) must not use shardedRoundTripper")
	}
	tr := transportOf(t, c)
	if tr.ForceAttemptHTTP2 {
		t.Errorf("http1 normalized must force http1")
	}
}

// --- 代理 + policy ---

func TestGetHttpClientWithProxyPolicy_ProxyHTTP(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}
	c, err := GetHttpClientWithProxyPolicy("http://127.0.0.1:0", policy)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	tr := transportOf(t, c)
	if tr.Proxy == nil {
		t.Errorf("http proxy policy client should set transport.Proxy")
	}
	if tr.ForceAttemptHTTP2 {
		t.Errorf("http1 policy with proxy must force http1")
	}
}

func TestGetHttpClientWithProxyPolicy_BadProxyScheme(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}
	_, err := GetHttpClientWithProxyPolicy("ftp://bad", policy)
	if err == nil {
		t.Errorf("bad proxy scheme should return error")
	}
}

// --- 端到端：实际 HTTP 请求链路 ---

func TestPolicyClient_EndToEnd_HTTP1Server(t *testing.T) {
	ResetPolicyProxyClientCache()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Echo", "ok")
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "hello")
	}))
	defer srv.Close()

	policies := []struct {
		name   string
		policy HTTPTransportPolicy
	}{
		{"default", defaultHTTPTransportPolicy()},
		{"http1", HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}},
		{"http2_shards4", HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolAuto, Shards: 4}},
	}
	for _, tc := range policies {
		t.Run(tc.name, func(t *testing.T) {
			ResetPolicyProxyClientCache()
			c, err := GetHttpClientWithProxyPolicy("", tc.policy)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			req, _ := http.NewRequest(http.MethodGet, srv.URL, nil)
			resp, err := c.Do(req)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				t.Errorf("status = %d", resp.StatusCode)
			}
			if resp.Header.Get("X-Echo") != "ok" {
				t.Errorf("X-Echo header missing")
			}
			// httptest.NewServer 为 HTTP/1.1，三种 policy 都应能完成请求
			if resp.Proto != "HTTP/1.1" {
				t.Errorf("httptest server proto = %s, want HTTP/1.1", resp.Proto)
			}
		})
	}
}

// --- HTTP/2 ALPN 协商：auto → HTTP/2.0，http1 → HTTP/1.1 ---

func TestPolicyClient_HTTP2Negotiation(t *testing.T) {
	// 用 NewUnstartedServer + EnableHTTP2 + StartTLS 让测试服务器真正广告 h2。
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = io.WriteString(w, "ok")
	}))
	srv.EnableHTTP2 = true
	srv.StartTLS()
	defer srv.Close()

	pool := x509.NewCertPool()
	pool.AddCert(srv.Certificate())

	doRequest := func(policy HTTPTransportPolicy) string {
		ResetPolicyProxyClientCache()
		// 直接用 buildLegacyRelayTransport + applyHTTPTransportPolicy 构建受信 transport，
		// 注入测试 CA（生产路径用 InsecureTLSConfig/系统 CA，此处隔离测试 ALPN 协商）。
		tr, err := buildLegacyRelayTransport("")
		if err != nil {
			t.Fatalf("build transport: %v", err)
		}
		// 显式声明 ALPN 意图：auto 允许 h2，http1 由 applyHTTP1Force 清空 NextProtos 强制 http1。
		// RootCAs 使客户端信任 httptest 自签证书。
		tr.TLSClientConfig = &tls.Config{RootCAs: pool, NextProtos: []string{"h2", "http/1.1"}}
		applyHTTPTransportPolicy(tr, policy)
		c := newRelayHTTPClient(tr)
		req, _ := http.NewRequest(http.MethodGet, srv.URL, nil)
		resp, err := c.Do(req)
		if err != nil {
			t.Fatalf("request failed (policy=%s): %v", policy.cacheKeyPart(), err)
		}
		defer resp.Body.Close()
		return resp.Proto
	}

	// auto policy → 应协商 HTTP/2.0
	if proto := doRequest(HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolAuto, Shards: 1}); proto != "HTTP/2.0" {
		t.Errorf("auto policy proto = %s, want HTTP/2.0 (ALPN h2)", proto)
	}
	// http1 policy → 应强制 HTTP/1.1
	if proto := doRequest(HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}); proto != "HTTP/1.1" {
		t.Errorf("http1 policy proto = %s, want HTTP/1.1 (forced)", proto)
	}
}

// --- GetRelayHTTPClient：context 桥接 ---

func TestGetRelayHTTPClient_ContextBridge(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ResetPolicyProxyClientCache()

	// 1. 无 key → 默认 → 旧版 httpClient
	c1, _ := gin.CreateTestContext(nil)
	client, err := GetRelayHTTPClient(c1, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if client != GetHttpClient() {
		t.Errorf("no policy key should delegate to legacy httpClient")
	}

	// 2. context 存 http1 policy → policy 客户端
	c2, _ := gin.CreateTestContext(nil)
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}
	c2.Set(string(constant.ContextKeyChannelHTTPTransportPolicy), policy)
	client2, err := GetRelayHTTPClient(c2, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	tr, ok := client2.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("expected *http.Transport for http1 policy, got %T", client2.Transport)
	}
	if tr.ForceAttemptHTTP2 {
		t.Errorf("http1 policy via context must force http1")
	}

	// 3. context 存默认 policy → 旧版
	c3, _ := gin.CreateTestContext(nil)
	c3.Set(string(constant.ContextKeyChannelHTTPTransportPolicy), defaultHTTPTransportPolicy())
	client3, err := GetRelayHTTPClient(c3, "")
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if client3 != GetHttpClient() {
		t.Errorf("default policy via context should delegate to legacy httpClient")
	}
}

// --- 桥接 helper resolveChannelHTTPTransportPolicy 行为（通过 policy 间接验证） ---

func TestNormalizeHTTPTransportPolicy_UnconfiguredIsDefault(t *testing.T) {
	// 未配置任何 HTTP transport 字段 → 默认 policy
	p := NormalizeHTTPTransportPolicy(relaykitdto.ChannelSettings{})
	if p != defaultHTTPTransportPolicy() {
		t.Errorf("unconfigured settings should yield default policy, got %s", p.cacheKeyPart())
	}
}

// --- 缓存：相同 key 复用客户端 ---

func TestGetHttpClientWithProxyPolicy_Caching(t *testing.T) {
	ResetPolicyProxyClientCache()
	policy := HTTPTransportPolicy{Protocol: relaykitdto.HTTPProtocolHTTP1, Shards: 1}
	c1, _ := GetHttpClientWithProxyPolicy("", policy)
	c2, _ := GetHttpClientWithProxyPolicy("", policy)
	if c1 != c2 {
		t.Errorf("same policy+proxy should return cached same client pointer")
	}
}

// 防止未用 import（json 用于潜在扩展；保留 common/constant 用于 context 测试）
var _ = json.Marshal
var _ = common.RelayMaxIdleConns
var _ = context.Background
var _ time.Duration
var _ = strings.TrimSpace
