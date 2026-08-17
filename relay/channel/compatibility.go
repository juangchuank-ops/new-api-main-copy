package channel

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/google/uuid"
)

// compatibility.go — 移植自新版 MAakber/new-api（P3 relay-runtime Client Identity）。
// 仅迁移与 ClientIdentity 相关的请求头应用逻辑；未配置 ClientIdentity 时保持旧版行为。
// identity 参数通过桥接 helper 从渠道 OtherSettings JSON 解析得到，不改动旧版
// dto.ChannelOtherSettings 与 relay/common/relay_info.go 的 ChannelOtherSettings 类型。

const (
	codexCompatibilityOriginator = "codex_cli_rs"
	codexCompatibilityUserAgent  = "codex_cli_rs/0.146.0"
	claudeCodeCompatibilityUA    = "claude-cli/2.1.214 (external, cli)"
)

// ApplyCompatibilityHeaders applies the default upstream identity for API-key
// compatibility channels. Request construction must apply Header Override
// afterward so an explicit override remains final.
func ApplyCompatibilityHeaders(channelType int, headers http.Header, apiKey string, isStream bool) {
	ApplyCompatibilityHeadersWithClientIdentity(channelType, headers, apiKey, isStream, "", nil)
}

// ApplyCompatibilityHeadersWithConversation preserves WorkBuddy's stable
// session identity while keeping request/message IDs unique per turn.
func ApplyCompatibilityHeadersWithConversation(channelType int, headers http.Header, apiKey string, isStream bool, conversationID string) {
	ApplyCompatibilityHeadersWithClientIdentity(channelType, headers, apiKey, isStream, conversationID, nil)
}

// ApplyCompatibilityHeadersWithClientIdentity applies the fixed protocol
// headers and the validated channel client identity. The identity object is
// intentionally a compact DTO; it cannot supply arbitrary header names or
// values.
func ApplyCompatibilityHeadersWithClientIdentity(channelType int, headers http.Header, apiKey string, isStream bool, conversationID string, identity *dto.ClientIdentityConfig) {
	switch channelType {
	case constant.ChannelTypeCodeBuddy:
		applyCodeBuddyHeaders(headers, apiKey, conversationID, isStream, identity)
	case constant.ChannelTypeCodexCompatibility:
		config := resolveRuntimeClientIdentity(channelType, identity)
		headers.Set("Authorization", "Bearer "+apiKey)
		headers.Set("OpenAI-Beta", "responses=experimental")
		headers.Set("Originator", codexCompatibilityOriginator)
		headers.Set("User-Agent", codexCompatibilityUserAgentFor(config))
		headers.Set("Content-Type", "application/json")
		if isStream {
			headers.Set("Accept", "text/event-stream")
		} else {
			headers.Set("Accept", "application/json")
		}
	}
}

// ApplyCodexLegacyClientIdentity applies only the safe identity fields for
// channel 57. Its OAuth adapter owns Authorization and account routing, so
// this function never touches credentials, endpoint paths, or Originator.
func ApplyCodexLegacyClientIdentity(headers http.Header, identity *dto.ClientIdentityConfig) {
	if identity == nil || identity.IsZero() {
		return
	}
	config := resolveRuntimeClientIdentity(constant.ChannelTypeCodex, identity)
	version := strings.TrimSpace(config.Version)
	if version == "" {
		version = strings.TrimPrefix(codexCompatibilityUserAgent, "codex_cli_rs/")
	}
	headers.Set("User-Agent", clientIdentityUserAgent("codex_cli_rs", version, config.Platform))
}

// ApplyLightweightClientIdentity applies only the verified, low-risk identity
// fields for standard OpenAI/Anthropic channels. It deliberately does not add
// authentication, endpoint, protocol, session, or request-body fields.
// identity 为 nil 或 IsZero 时直接返回，保持旧版请求行为（不加任何 Header）。
func ApplyLightweightClientIdentity(headers http.Header, identity *dto.ClientIdentityConfig) {
	if headers == nil || identity == nil || identity.IsZero() {
		return
	}

	switch identity.Profile {
	case dto.ClientIdentityProfileCodexCLI:
		version := strings.TrimSpace(identity.Version)
		if version == "" {
			version = strings.TrimPrefix(codexCompatibilityUserAgent, "codex_cli_rs/")
		}
		headers.Set("User-Agent", clientIdentityUserAgent("codex_cli_rs", version, identity.Platform))
	case dto.ClientIdentityProfileClaudeCLI:
		config := *identity
		version := strings.TrimSpace(config.Version)
		if version == "" {
			version = strings.TrimPrefix(claudeCodeCompatibilityUA, "claude-cli/")
			if index := strings.Index(version, " "); index >= 0 {
				version = version[:index]
			}
		}
		config.Version = version
		headers.Set("User-Agent", claudeCodeUserAgentFor(config))
	case dto.ClientIdentityProfileCodeBuddyCLI:
		// This header is documented for CodeBuddy's local HTTP API. The
		// lightweight profile opts into that single marker and nothing else.
		headers.Set("X-CodeBuddy-Request", "1")
	case dto.ClientIdentityProfileWorkBuddyDesktop:
		// No stable public WorkBuddy Desktop request identity is verified.
		// Keep the profile available for metadata/manual versioning without
		// inventing a User-Agent or internal headers.
	case dto.ClientIdentityProfileCodexDesktop:
		// 已对照 codex-rs 官方源码验证（login/src/auth/default_client.rs）：
		// ChatGPT 桌面端内的 Codex 通过 originator 头标识为 codex_chatgpt_desktop
		// （is_first_party_chat_originator 一方枚举），User-Agent 前缀同步使用该值。
		// 版本必填后才写入请求头。
		if version := strings.TrimSpace(identity.Version); version != "" {
			headers.Set("originator", "codex_chatgpt_desktop")
			headers.Set("User-Agent", clientIdentityUserAgent("codex_chatgpt_desktop", version, identity.Platform))
		}
	case dto.ClientIdentityProfileClaudeDesktop:
		// Claude 官方桌面应用不调用公开 Anthropic API，无公开可验证身份；
		// 前缀沿用 claude 家族命名规范（claude-cli → claude-desktop），版本必填才生效。
		if version := strings.TrimSpace(identity.Version); version != "" {
			headers.Set("User-Agent", clientIdentityUserAgent("claude-desktop", version, identity.Platform))
		}
	}
}

// ApplyClaudeCodeCompatibilityHeaders applies the default Claude Code
// upstream identity. It is deliberately separate from generic compatibility
// profiles because it runs after adapter setup and before Header Override.
// includeAPIKey controls the x-api-key credential header: the Gateway protocol
// requires both Authorization and x-api-key on inference requests, but only one
// credential header on GET /v1/models.
func ApplyClaudeCodeCompatibilityHeaders(headers http.Header, apiKey string, isStream bool, sessionID string, includeAPIKey bool) {
	ApplyClaudeCodeCompatibilityHeadersWithIdentity(headers, apiKey, isStream, sessionID, includeAPIKey, nil)
}

// ApplyClaudeCodeCompatibilityHeadersWithIdentity applies the Claude Code
// protocol defaults while allowing only a validated version/platform to vary.
func ApplyClaudeCodeCompatibilityHeadersWithIdentity(headers http.Header, apiKey string, isStream bool, sessionID string, includeAPIKey bool, identity *dto.ClientIdentityConfig) {
	config := resolveRuntimeClientIdentity(constant.ChannelTypeClaudeCode, identity)
	for name := range headers {
		if isClaudeCodeManagedHeader(strings.ToLower(name)) {
			// http.Header.Del canonicalizes its argument, which can leave a
			// differently-cased map key behind. Delete the actual key instead.
			delete(headers, name)
		}
	}

	headers.Set("Authorization", "Bearer "+apiKey)
	if includeAPIKey {
		headers.Set("X-Api-Key", apiKey)
	}
	headers.Set("User-Agent", claudeCodeUserAgentFor(config))
	headers.Set("X-App", "cli")
	headers.Set("Anthropic-Version", "2023-06-01")
	headers.Set("Content-Type", "application/json")
	if isStream {
		headers.Set("Accept", "text/event-stream")
	} else {
		headers.Set("Accept", "application/json")
	}
	if sessionID != "" {
		headers.Set("X-Claude-Code-Session-Id", sessionID)
	}
	if headers.Get("X-Client-Request-Id") == "" {
		headers.Set("X-Client-Request-Id", uuid.NewString())
	}
}

func resolveRuntimeClientIdentity(channelType int, identity *dto.ClientIdentityConfig) dto.ClientIdentityConfig {
	if identity == nil {
		return dto.DefaultClientIdentityConfig(channelType)
	}
	config := *identity
	if identity.Source != nil {
		sourceCopy := *identity.Source
		config.Source = &sourceCopy
	}
	if err := config.Normalize(channelType); err != nil {
		return dto.DefaultClientIdentityConfig(channelType)
	}
	return config
}

func codexCompatibilityUserAgentFor(config dto.ClientIdentityConfig) string {
	version := strings.TrimSpace(config.Version)
	if version == "" {
		version = strings.TrimPrefix(codexCompatibilityUserAgent, "codex_cli_rs/")
	}
	return clientIdentityUserAgent("codex_cli_rs", version, config.Platform)
}

func claudeCodeUserAgentFor(config dto.ClientIdentityConfig) string {
	version := strings.TrimSpace(config.Version)
	if version == "" {
		version = strings.TrimPrefix(claudeCodeCompatibilityUA, "claude-cli/")
		if index := strings.Index(version, " "); index >= 0 {
			version = version[:index]
		}
	}
	platform, err := dto.NormalizeClientIdentityPlatform(config.Platform)
	if err != nil || platform == "" {
		return "claude-cli/" + version + " (external, cli)"
	}
	return "claude-cli/" + version + " (external, cli; " + platform + ")"
}

func clientIdentityUserAgent(product, version, platform string) string {
	userAgent := product + "/" + version
	if normalized, err := dto.NormalizeClientIdentityPlatform(platform); err == nil && normalized != "" {
		userAgent += " (" + normalized + ")"
	}
	return userAgent
}

func isClaudeCodeManagedHeader(lowerName string) bool {
	switch lowerName {
	case "authorization",
		"proxy-authorization",
		"cookie",
		"user-agent",
		"anthropic-version",
		"content-type",
		"accept",
		"x-api-key",
		"x-goog-api-key",
		"x-app",
		"x-claude-code-session-id",
		"x-client-request-id",
		"anthropic-dangerous-direct-browser-access",
		"accept-language":
		return true
	default:
		// x-stainless-* 与真实客户端一致，保留透传（客户端携带时原样转发）。
		return strings.HasPrefix(lowerName, "sec-fetch-")
	}
}
