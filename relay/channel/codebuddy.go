package channel

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/google/uuid"
)

// codebuddy.go — 移植自新版 MAakber/new-api（P3 relay-runtime Client Identity）。
// 仅迁移与 ClientIdentity / 请求头相关的逻辑：
//   - applyCodeBuddyHeaders：被 compatibility.go 的 ApplyCompatibilityHeadersWithClientIdentity
//     在 ChannelTypeCodeBuddy 分支调用，使用 identity 设置 User-Agent / X-Stainless-OS/Arch 等。
//   - ResolveCodeBuddyConversationID：派生稳定的会话 ID。
// 未移植 ApplyCodeBuddyRequestProfile / CleanupCodexForbiddenPhraseInMessages：
//   那属于请求体改写（system prompt 注入），不是 ClientIdentity 范畴，且旧版无 CodeBuddy
//   adaptor 调用它，移植会形成 dead code。如后续启用 CodeBuddy 渠道主体逻辑再单独移植。

const (
	codeBuddyProductVersion = "5.3.8"
	codeBuddyCLIUserAgent   = "2.115.0"
)

func applyCodeBuddyHeaders(headers http.Header, apiKey, conversationID string, isStream bool, identity *dto.ClientIdentityConfig) {
	config := resolveRuntimeClientIdentity(dto.ClientIdentityChannelTypeCodeBuddy, identity)
	productVersion := strings.TrimSpace(config.Version)
	if productVersion == "" {
		productVersion = codeBuddyProductVersion
	}
	conversationID = strings.TrimSpace(conversationID)
	if conversationID == "" {
		conversationID = uuid.NewString()
	}
	traceID := codeBuddyRandomHex(16)
	spanID := codeBuddyRandomHex(8)
	// 与官方客户端抓包一致：X-Request-ID 与 X-Conversation-Message-ID 共用 32-hex
	// messageId；X-Conversation-Request-ID 为独立的 32-hex。B3 链路中 span 与
	// parent span 相同。
	messageID := strings.ReplaceAll(uuid.NewString(), "-", "")
	conversationRequestID := strings.ReplaceAll(uuid.NewString(), "-", "")

	headers.Set("Authorization", "Bearer "+apiKey)
	headers.Set("X-API-Key", apiKey)
	headers.Set("Accept", "application/json")
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "WorkBuddy/"+productVersion+" WorkBuddy/"+productVersion+" CLI/"+codeBuddyCLIUserAgent)
	headers.Set("X-Agent-Intent", "craft")
	headers.Set("X-Agent-Purpose", "conversation")
	headers.Set("X-Domain", "www.codebuddy.cn")
	headers.Set("X-IDE-Name", "WorkBuddy")
	headers.Set("X-IDE-Type", "WorkBuddy")
	headers.Set("X-IDE-Version", productVersion)
	headers.Set("X-Product", "SaaS")
	headers.Set("X-Requested-With", "XMLHttpRequest")
	headers.Set("X-Stainless-Arch", "x64")
	headers.Set("X-Stainless-Lang", "js")
	headers.Set("X-Stainless-OS", "Windows")
	if osName, arch, ok := dto.ClientIdentityPlatformRuntime(config.Platform); ok {
		headers.Set("X-Stainless-OS", osName)
		headers.Set("X-Stainless-Arch", arch)
	}
	headers.Set("X-Stainless-Package-Version", "6.25.0")
	headers.Set("X-Stainless-Retry-Count", "0")
	headers.Set("X-Stainless-Runtime", "node")
	headers.Set("X-Stainless-Runtime-Version", "v22.21.1")
	// ACP 连接 ID 在同一会话内保持稳定（真实客户端在同一 ACP 连接生命周期内不变）。
	headers.Set("Acp-Connection-ID", uuid.NewSHA1(uuid.NameSpaceURL, []byte("workbuddy-acp:"+conversationID)).String())
	headers.Set("X-CodeBuddy-Request", "1")
	headers.Set("X-Conversation-ID", conversationID)
	headers.Set("X-Conversation-Message-ID", messageID)
	headers.Set("X-Conversation-Request-ID", conversationRequestID)
	headers.Set("X-Request-ID", messageID)
	// 用户维度标识：下游若已自带 X-User-Id 则透传，否则派生稳定 UUID（会话内不变）。
	// 对方非官方，无法校验真实 SSO 值，仅需保证格式合法。
	if headers.Get("X-User-Id") == "" {
		headers.Set("X-User-Id", codeBuddyUserUUID(conversationID))
	}
	headers.Set("B3", traceID+"-"+spanID+"-1-"+spanID)
	headers.Set("Traceparent", "00-"+traceID+"-"+spanID+"-01")
	headers.Set("X-B3-ParentSpanID", spanID)
	headers.Set("X-B3-Sampled", "1")
	headers.Set("X-B3-SpanID", spanID)
	headers.Set("X-B3-TraceID", traceID)
	headers.Set("X-Trace-ID", traceID)
}

// codeBuddyUserUUID derives a stable, UUID-shaped user identifier from the
// conversation key. It is a simulation stand-in for the SSO user id that the
// official client would send; non-official upstreams cannot validate it.
func codeBuddyUserUUID(conversationID string) string {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("workbuddy-user:"+strings.TrimSpace(conversationID))).String()
}

// ResolveCodeBuddyConversationID maps a caller's stable conversation key to
// the UUID-shaped session ID emitted by the official WorkBuddy client. The
// raw key is never sent upstream.
func ResolveCodeBuddyConversationID(incoming http.Header, request dto.Request) string {
	if incoming != nil {
		if value := strings.TrimSpace(incoming.Get("X-Conversation-ID")); value != "" {
			if parsed, err := uuid.Parse(value); err == nil {
				return parsed.String()
			}
			return codeBuddyConversationUUID(value)
		}
	}

	var key string
	switch value := request.(type) {
	case *dto.GeneralOpenAIRequest:
		if value != nil {
			key = value.PromptCacheKey
		}
	case *dto.OpenAIResponsesRequest:
		if value != nil {
			key = codeBuddyJSONString(value.PromptCacheKey)
			if key == "" {
				key = codeBuddyJSONString(value.Conversation)
			}
		}
	}
	if key == "" {
		return ""
	}
	return codeBuddyConversationUUID(key)
}

func codeBuddyConversationUUID(key string) string {
	return uuid.NewSHA1(uuid.NameSpaceURL, []byte("workbuddy-conversation:"+strings.TrimSpace(key))).String()
}

func codeBuddyJSONString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}

func codeBuddyRandomHex(bytes int) string {
	value := make([]byte, bytes)
	if _, err := rand.Read(value); err == nil {
		return hex.EncodeToString(value)
	}
	fallback := strings.ReplaceAll(uuid.NewString(), "-", "")
	return fallback[:bytes*2]
}
