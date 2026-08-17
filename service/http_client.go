package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/proxy"
)

var (
	httpClient      *http.Client
	proxyClientLock sync.Mutex
	proxyClients    = make(map[string]*http.Client)
)

func checkRedirect(req *http.Request, via []*http.Request) error {
	fetchSetting := system_setting.GetFetchSetting()
	urlStr := req.URL.String()
	if err := common.ValidateURLWithFetchSetting(urlStr, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func InitHttpClient() {
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
		ForceAttemptHTTP2:   true,
		Proxy:               http.ProxyFromEnvironment, // Support HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}

	if common.RelayTimeout == 0 {
		httpClient = &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
	} else {
		httpClient = &http.Client{
			Transport:     transport,
			Timeout:       time.Duration(common.RelayTimeout) * time.Second,
			CheckRedirect: checkRedirect,
		}
	}
}

func GetHttpClient() *http.Client {
	return httpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClient(), nil
	}
	return NewProxyHttpClient(proxyURL)
}

// GetLoginHTTPClient returns an *http.Client configured for external login
// flows (GitHub/Discord/LinuxDO/OIDC/Generic/WeChat OAuth). When LoginProxyURL
// is set, the returned client routes through that proxy; otherwise it behaves
// like a plain http.Client with the given timeout. Mirrors
// new-api-reference/service/http_client.go GetLoginHTTPClient.
func GetLoginHTTPClient(timeout time.Duration) (*http.Client, error) {
	proxyURL := setting.GetLoginProxyURL()
	if proxyURL == "" {
		return &http.Client{Timeout: timeout}, nil
	}
	proxyClient, err := GetHttpClientWithProxy(proxyURL)
	if err != nil {
		return nil, err
	}
	return &http.Client{Transport: proxyClient.Transport, Timeout: timeout}, nil
}

// ResetProxyClientCache 清空代理客户端缓存，确保下次使用时重新初始化
func ResetProxyClientCache() {
	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	for _, client := range proxyClients {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	proxyClients = make(map[string]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	proxyClientLock.Lock()
	if client, ok := proxyClients[proxyURL]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
			ForceAttemptHTTP2:   true,
			Proxy:               http.ProxyURL(parsedURL),
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}
		client := &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
		proxyClientLock.Unlock()
		return client, nil

	case "socks5", "socks5h":
		// 获取认证信息
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{
				User:     parsedURL.User.Username(),
				Password: "",
			}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}

		// 创建 SOCKS5 代理拨号器
		// proxy.SOCKS5 使用 tcp 参数，所有 TCP 连接包括 DNS 查询都将通过代理进行。行为与 socks5h 相同
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}

		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
			ForceAttemptHTTP2:   true,
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			},
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}

		client := &http.Client{Transport: transport, CheckRedirect: checkRedirect}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
		proxyClientLock.Unlock()
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}

// =====================================================================
// P3-Bridge: HTTP transport policy 接入（双轨 + 最小侵入）
// 目标：让已迁移的 NormalizeHTTPTransportPolicy / shardedRoundTripper /
//   applyHTTPTransportPolicy / HTTPProtocol / HTTP2ConnectionShards 真正进入
//   旧版 HTTP 请求链路，而不迁移整个新版 http_client.go。
// 规则：
//   - policy 为默认（未配置新版 HTTP transport）→ 直接走旧版 GetHttpClientWithProxy，
//     行为零变化（保留旧版 Proxy/Timeout/TLS/代理认证）。
//   - policy 非默认（HTTPProtocol=http1 或 shards>1）→ 构建 policy-aware 客户端。
//   - 不使用新版 ParseProxyURLRuntime / GetLoginProxyURL（旧版无此依赖），
//     代理解析沿用旧版 url.Parse 路径。
// =====================================================================

var (
	policyProxyClients    = make(map[string]*http.Client)
	policyProxyClientLock sync.Mutex
)

// newRelayHTTPClient 用旧版 relay 客户端配置（CheckRedirect + RelayTimeout）包装 transport。
func newRelayHTTPClient(transport http.RoundTripper) *http.Client {
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if common.RelayTimeout != 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return client
}

// buildLegacyRelayTransport 构建与旧版 NewProxyHttpClient 行为一致的 *http.Transport
// （MaxIdleConns/IdleConnTimeout/ForceAttemptHTTP2/TLS/代理认证均沿用旧版），
// 供 policy 路径在其上叠加 HTTP transport policy。proxyURL 为空时返回直连 transport。
func buildLegacyRelayTransport(proxyURL string) (*http.Transport, error) {
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
		ForceAttemptHTTP2:   true,
		Proxy:               http.ProxyFromEnvironment,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}
	if proxyURL == "" {
		return transport, nil
	}
	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}
	switch parsedURL.Scheme {
	case "http", "https":
		transport.Proxy = http.ProxyURL(parsedURL)
		return transport, nil
	case "socks5", "socks5h":
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{User: parsedURL.User.Username()}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}
		transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		}
		transport.Proxy = nil
		return transport, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}

// GetHttpClientWithProxyPolicy 返回按 policy 构建的 HTTP 客户端。
// policy 为默认（未配置新版 HTTP transport）时，直接走旧版 GetHttpClientWithProxy，行为零变化。
// policy 非默认时：HTTP/1.1 强制单 transport，或 HTTP/2 多分片 shardedRoundTripper。
func GetHttpClientWithProxyPolicy(proxyURL string, policy HTTPTransportPolicy) (*http.Client, error) {
	if policy == defaultHTTPTransportPolicy() {
		return GetHttpClientWithProxy(proxyURL)
	}
	cacheKey := proxyURL + "\x00" + policy.cacheKeyPart()
	policyProxyClientLock.Lock()
	if client, ok := policyProxyClients[cacheKey]; ok {
		policyProxyClientLock.Unlock()
		return client, nil
	}
	policyProxyClientLock.Unlock()

	// 多分片需提前校验代理配置，避免 factory 内部静默回退。
	if proxyURL != "" {
		if _, err := buildLegacyRelayTransport(proxyURL); err != nil {
			return nil, err
		}
	}

	if policy.Shards <= 1 {
		transport, err := buildLegacyRelayTransport(proxyURL)
		if err != nil {
			return nil, err
		}
		applyHTTPTransportPolicy(transport, policy)
		client := newRelayHTTPClient(transport)
		policyProxyClientLock.Lock()
		policyProxyClients[cacheKey] = client
		policyProxyClientLock.Unlock()
		return client, nil
	}

	// HTTP/2 多分片：每个 shard 一份独立 transport，均应用 policy。
	factory := func() *http.Transport {
		transport, err := buildLegacyRelayTransport(proxyURL)
		if err != nil {
			// 代理已在上方校验通过；此处理论上不会失败，兜底直连。
			transport, _ = buildLegacyRelayTransport("")
			if transport == nil {
				transport = &http.Transport{ForceAttemptHTTP2: true}
			}
		}
		applyHTTPTransportPolicy(transport, policy)
		return transport
	}
	client := newRelayHTTPClient(newShardedRoundTripper(policy, factory))
	policyProxyClientLock.Lock()
	policyProxyClients[cacheKey] = client
	policyProxyClientLock.Unlock()
	return client, nil
}

// GetRelayHTTPClient 读取 context 中的 HTTP transport policy，返回对应 HTTP 客户端。
// 未配置 policy（context 无 key 或为默认）时走旧版逻辑，保持旧版请求行为。
// 旧版 relay HTTP 请求链路（doRequest）的桥接入口。
func GetRelayHTTPClient(c *gin.Context, proxyURL string) (*http.Client, error) {
	policy, ok := common.GetContextKeyType[HTTPTransportPolicy](c, constant.ContextKeyChannelHTTPTransportPolicy)
	if !ok {
		policy = defaultHTTPTransportPolicy()
	}
	return GetHttpClientWithProxyPolicy(proxyURL, policy)
}

// ResetPolicyProxyClientCache 清空 policy 客户端缓存（测试 / 配置变更时使用）。
func ResetPolicyProxyClientCache() {
	policyProxyClientLock.Lock()
	defer policyProxyClientLock.Unlock()
	for _, client := range policyProxyClients {
		client.CloseIdleConnections()
	}
	policyProxyClients = make(map[string]*http.Client)
}
