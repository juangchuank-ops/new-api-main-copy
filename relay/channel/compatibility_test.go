package channel

import (
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaykitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

// compatibility_test.go — P3 relay-runtime ClientIdentity 单测。
// 覆盖：未配置→保持旧版行为(不加 Header)；已配置→对应 Header 正确；
// 不同 profile/platform；不同协议路径；配置异常→不影响请求。

func newHeaders() http.Header { return http.Header{} }

// --- ApplyLightweightClientIdentity ---

func TestApplyLightweightClientIdentity_NilOrZero_NoHeaders(t *testing.T) {
	// 未配置 ClientIdentity：identity=nil → 必须不加任何 Header（保持旧版行为）
	h := newHeaders()
	ApplyLightweightClientIdentity(h, nil)
	if len(h) > 0 {
		t.Errorf("nil identity must not set any header, got: %v", h)
	}

	// IsZero 的非 nil config 同样不应加 Header
	h2 := newHeaders()
	ApplyLightweightClientIdentity(h2, &relaykitdto.ClientIdentityConfig{})
	if len(h2) > 0 {
		t.Errorf("zero identity must not set any header, got: %v", h2)
	}
}

func TestApplyLightweightClientIdentity_Profiles(t *testing.T) {
	cases := []struct {
		name       string
		profile    string
		version    string
		platform   string
		wantHeader string // header name
		wantSub    string // 期望出现的子串（User-Agent 值或 marker）
	}{
		{"codex_cli", relaykitdto.ClientIdentityProfileCodexCLI, "1.2.3", "linux-x64", "User-Agent", "codex_cli_rs/1.2.3 (linux-x64)"},
		{"codex_cli_no_version", relaykitdto.ClientIdentityProfileCodexCLI, "", "", "User-Agent", "codex_cli_rs/0.146.0"},
		{"claude_cli", relaykitdto.ClientIdentityProfileClaudeCLI, "2.1.0", "macos-arm64", "User-Agent", "claude-cli/2.1.0"},
		{"codebuddy_cli", relaykitdto.ClientIdentityProfileCodeBuddyCLI, "", "", "X-Codebuddy-Request", "1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newHeaders()
			ApplyLightweightClientIdentity(h, &relaykitdto.ClientIdentityConfig{
				Profile:  tc.profile,
				Version:  tc.version,
				Platform: tc.platform,
			})
			val := h.Get(tc.wantHeader)
			if val == "" {
				t.Fatalf("expected header %s set, got headers: %v", tc.wantHeader, h)
			}
			if !strings.Contains(val, tc.wantSub) {
				t.Errorf("header %s = %q, want substring %q", tc.wantHeader, val, tc.wantSub)
			}
		})
	}

	// workbuddy_desktop profile：无稳定公开标识，不应加任何 Header
	t.Run("workbuddy_desktop_no_headers", func(t *testing.T) {
		h := newHeaders()
		ApplyLightweightClientIdentity(h, &relaykitdto.ClientIdentityConfig{
			Profile: relaykitdto.ClientIdentityProfileWorkBuddyDesktop,
		})
		if len(h) > 0 {
			t.Errorf("workbuddy_desktop profile must not set any header, got: %v", h)
		}
	})
}

// --- ApplyCodexLegacyClientIdentity ---

func TestApplyCodexLegacyClientIdentity(t *testing.T) {
	// nil → no-op
	h := newHeaders()
	ApplyCodexLegacyClientIdentity(h, nil)
	if len(h) > 0 {
		t.Errorf("nil identity must not set any header, got: %v", h)
	}
	// 已配置 → User-Agent
	h2 := newHeaders()
	ApplyCodexLegacyClientIdentity(h2, &relaykitdto.ClientIdentityConfig{
		Profile:  relaykitdto.ClientIdentityProfileCodexLegacy,
		Version:  "1.5.0",
		Platform: "windows-x64",
	})
	ua := h2.Get("User-Agent")
	if !strings.Contains(ua, "codex_cli_rs/1.5.0") {
		t.Errorf("User-Agent = %q, want codex_cli_rs/1.5.0", ua)
	}
	if !strings.Contains(ua, "windows-x64") {
		t.Errorf("User-Agent = %q, want platform windows-x64", ua)
	}
}

// --- ApplyCompatibilityHeadersWithClientIdentity (CodexCompatibility / CodeBuddy) ---

func TestApplyCompatibilityHeadersWithClientIdentity_CodexCompatibility(t *testing.T) {
	h := newHeaders()
	ApplyCompatibilityHeadersWithClientIdentity(constant.ChannelTypeCodexCompatibility, h, "sk-test", true, "", &relaykitdto.ClientIdentityConfig{
		Profile: relaykitdto.ClientIdentityProfileCodexCompatibility,
		Version: "1.6.0",
	})
	checks := map[string]string{
		"Authorization": "Bearer sk-test",
		"Openai-Beta":   "responses=experimental",
		"Originator":    "codex_cli_rs",
		"Content-Type":  "application/json",
		"Accept":        "text/event-stream",
	}
	for k, want := range checks {
		if got := h.Get(k); got != want {
			t.Errorf("header %s = %q, want %q", k, got, want)
		}
	}
	if ua := h.Get("User-Agent"); !strings.Contains(ua, "codex_cli_rs/1.6.0") {
		t.Errorf("User-Agent = %q, want codex_cli_rs/1.6.0", ua)
	}
}

func TestApplyCompatibilityHeadersWithClientIdentity_CodeBuddy(t *testing.T) {
	h := newHeaders()
	ApplyCompatibilityHeadersWithClientIdentity(constant.ChannelTypeCodeBuddy, h, "sk-cb", false, "conv-123", &relaykitdto.ClientIdentityConfig{
		Profile:  relaykitdto.ClientIdentityProfileCodeBuddy,
		Version:  "9.9.9",
		Platform: "macos-arm64",
	})
	if got := h.Get("Authorization"); got != "Bearer sk-cb" {
		t.Errorf("Authorization = %q", got)
	}
	if ua := h.Get("User-Agent"); !strings.Contains(ua, "WorkBuddy/9.9.9") {
		t.Errorf("User-Agent = %q, want WorkBuddy/9.9.9", ua)
	}
	// platform 来自 identity → X-Stainless-OS 应为 macOS
	if got := h.Get("X-Stainless-Os"); got != "macOS" {
		t.Errorf("X-Stainless-OS = %q, want macOS (from identity platform macos-arm64)", got)
	}
	if got := h.Get("X-Stainless-Arch"); got != "arm64" {
		t.Errorf("X-Stainless-Arch = %q, want arm64", got)
	}
	if got := h.Get("X-Conversation-Id"); got != "conv-123" {
		t.Errorf("X-Conversation-ID = %q, want conv-123", got)
	}
}

func TestApplyCompatibilityHeadersWithClientIdentity_CodeBuddy_DefaultVersion(t *testing.T) {
	// CodeBuddy 未配置 version → 走默认 product version
	h := newHeaders()
	ApplyCompatibilityHeadersWithClientIdentity(constant.ChannelTypeCodeBuddy, h, "k", false, "", nil)
	ua := h.Get("User-Agent")
	if !strings.Contains(ua, "WorkBuddy/"+codeBuddyProductVersion) {
		t.Errorf("User-Agent = %q, want default WorkBuddy/%s", ua, codeBuddyProductVersion)
	}
}

// --- ApplyClaudeCodeCompatibilityHeadersWithIdentity ---

func TestApplyClaudeCodeCompatibilityHeadersWithIdentity(t *testing.T) {
	h := newHeaders()
	// 预置一个 managed header 验证会被清理
	h.Set("User-Agent", "old-ua")
	ApplyClaudeCodeCompatibilityHeadersWithIdentity(h, "sk-cc", true, "sess-1", true, &relaykitdto.ClientIdentityConfig{
		Profile:  relaykitdto.ClientIdentityProfileClaudeCode,
		Version:  "2.1.214",
		Platform: "linux-x64",
	})
	if got := h.Get("Authorization"); got != "Bearer sk-cc" {
		t.Errorf("Authorization = %q", got)
	}
	if got := h.Get("X-Api-Key"); got != "sk-cc" {
		t.Errorf("X-Api-Key = %q", got)
	}
	if got := h.Get("Anthropic-Version"); got != "2023-06-01" {
		t.Errorf("Anthropic-Version = %q", got)
	}
	if got := h.Get("X-App"); got != "cli" {
		t.Errorf("X-App = %q", got)
	}
	if ua := h.Get("User-Agent"); !strings.Contains(ua, "claude-cli/2.1.214") {
		t.Errorf("User-Agent = %q, want claude-cli/2.1.214", ua)
	}
	if got := h.Get("X-Claude-Code-Session-Id"); got != "sess-1" {
		t.Errorf("session id = %q", got)
	}
}

// --- resolveRuntimeClientIdentity 异常容错 ---

func TestResolveRuntimeClientIdentity_InvalidFallsBackToDefault(t *testing.T) {
	// 配置异常（profile 与 channelType 不匹配）→ Normalize 失败 → 回退默认，不应 panic
	h := newHeaders()
	// 给一个明显错误的 profile，CodexCompatibility channel 期望 codex_compatibility profile
	ApplyCompatibilityHeadersWithClientIdentity(constant.ChannelTypeCodexCompatibility, h, "k", false, "", &relaykitdto.ClientIdentityConfig{
		Profile: "totally-invalid-profile",
	})
	// 仍应设置协议默认头（Authorization 等），不崩溃
	if got := h.Get("Authorization"); got != "Bearer k" {
		t.Errorf("Authorization = %q, want Bearer k (protocol defaults must still apply on identity error)", got)
	}
}

// --- 桥接 helper resolveChannelClientIdentityFromContext ---

func TestResolveChannelClientIdentityFromContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	// 1. 无 key → nil
	c1, _ := gin.CreateTestContext(nil)
	if got := resolveChannelClientIdentityFromContext(c1); got != nil {
		t.Errorf("absent key should return nil, got %v", got)
	}
	// 2. 存 nil identity → nil
	c2, _ := gin.CreateTestContext(nil)
	c2.Set(string(constant.ContextKeyChannelClientIdentity), (*relaykitdto.ClientIdentityConfig)(nil))
	if got := resolveChannelClientIdentityFromContext(c2); got != nil {
		t.Errorf("nil-stored identity should return nil, got %v", got)
	}
	// 3. 存有效 identity → 返回该 identity
	c3, _ := gin.CreateTestContext(nil)
	stored := &relaykitdto.ClientIdentityConfig{
		Profile: relaykitdto.ClientIdentityProfileCodexCLI,
		Version: "1.0.0",
	}
	c3.Set(string(constant.ContextKeyChannelClientIdentity), stored)
	got := resolveChannelClientIdentityFromContext(c3)
	if got == nil {
		t.Fatalf("expected identity, got nil")
	}
	if got.Profile != stored.Profile || got.Version != stored.Version {
		t.Errorf("identity = %+v, want %+v", got, stored)
	}
	// 4. nil context → nil
	if got := resolveChannelClientIdentityFromContext(nil); got != nil {
		t.Errorf("nil context should return nil, got %v", got)
	}
}

// --- 端到端：未配置 identity 时 ApplyLightweightClientIdentity 与 Header Override 顺序无关地保持旧版 ---
func TestUnconfiguredIdentityPreservesLegacyHeaders(t *testing.T) {
	// 模拟旧版请求头（adaptor 已设置 Authorization），叠加 nil identity 不应改动
	h := newHeaders()
	h.Set("Authorization", "Bearer legacy")
	h.Set("User-Agent", "legacy-ua")
	ApplyLightweightClientIdentity(h, nil)
	if got := h.Get("Authorization"); got != "Bearer legacy" {
		t.Errorf("Authorization changed: %q", got)
	}
	if got := h.Get("User-Agent"); got != "legacy-ua" {
		t.Errorf("User-Agent changed by nil identity: %q (must stay legacy-ua)", got)
	}
}
