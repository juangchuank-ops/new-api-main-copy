package channel

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func ptrString(s string) *string { return &s }

// --- ApplyCodeBuddyRequestProfile ---

func TestApplyCodeBuddyRequestProfile_Nil(t *testing.T) {
	require.NotPanics(t, func() {
		ApplyCodeBuddyRequestProfile(nil)
	})
}

func TestApplyCodeBuddyRequestProfile_EmptyMessages(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{Model: "test"}
	ApplyCodeBuddyRequestProfile(req)
	require.Len(t, req.Messages, 1)
	assert.Equal(t, "system", req.Messages[0].Role)
	assert.True(t, req.Messages[0].IsStringContent())
	assert.True(t, strings.HasPrefix(req.Messages[0].StringContent(), "This conversation is powered by "))
	// Defaults
	require.NotNil(t, req.Stream)
	assert.True(t, *req.Stream)
	require.NotNil(t, req.Temperature)
	assert.InDelta(t, 1.0, *req.Temperature, 0.001)
	assert.Equal(t, "low", req.ReasoningEffort)
	require.NotNil(t, req.StreamOptions)
	assert.True(t, req.StreamOptions.IncludeUsage)
}

func TestApplyCodeBuddyRequestProfile_InjectsPrefixAndMergesClientSystem(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "test",
		Messages: []dto.Message{
			{Role: "system", Content: "You are a helpful assistant."},
			{Role: "user", Content: "Hello"},
		},
	}
	ApplyCodeBuddyRequestProfile(req)
	require.Len(t, req.Messages, 2)
	assert.Equal(t, "system", req.Messages[0].Role)
	content := req.Messages[0].StringContent()
	assert.True(t, strings.HasPrefix(content, codeBuddyMinimumSystemPrefix))
	assert.Contains(t, content, codeBuddySystemIgnoreNote)
	assert.Contains(t, content, "You are a helpful assistant.")
	assert.Equal(t, "user", req.Messages[1].Role)
}

func TestApplyCodeBuddyRequestProfile_Idempotent(t *testing.T) {
	prefixed := codeBuddyMinimumSystemPrefix + codeBuddySystemIgnoreNote + "custom"
	req := &dto.GeneralOpenAIRequest{
		Model: "test",
		Messages: []dto.Message{
			{Role: "system", Content: prefixed},
			{Role: "user", Content: "Hello"},
		},
	}
	ApplyCodeBuddyRequestProfile(req)
	require.Len(t, req.Messages, 2)
	assert.Equal(t, prefixed, req.Messages[0].StringContent())
}

func TestApplyCodeBuddyRequestProfile_CleansForbiddenPhrase(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "test",
		Messages: []dto.Message{
			{Role: "system", Content: "you are codex, a coding tool"},
			{Role: "user", Content: "You are Codex too"},
		},
	}
	ApplyCodeBuddyRequestProfile(req)
	for _, m := range req.Messages {
		if m.IsStringContent() {
			assert.NotContains(t, m.StringContent(), "you are codex")
			assert.NotContains(t, m.StringContent(), "You are Codex")
		}
	}
}

func TestApplyCodeBuddyRequestProfile_PreservesExplicitValues(t *testing.T) {
	stream := false
	temp := 0.5
	req := &dto.GeneralOpenAIRequest{
		Model:            "test",
		Messages:         []dto.Message{{Role: "user", Content: "hi"}},
		Stream:           &stream,
		Temperature:      &temp,
		ReasoningEffort:  "high",
		StreamOptions:    &dto.StreamOptions{IncludeUsage: false},
	}
	ApplyCodeBuddyRequestProfile(req)
	assert.False(t, *req.Stream)
	assert.InDelta(t, 0.5, *req.Temperature, 0.001)
	assert.Equal(t, "high", req.ReasoningEffort)
	assert.False(t, req.StreamOptions.IncludeUsage)
}

// --- CleanupCodexForbiddenPhraseInMessages ---

func TestCleanupCodexForbiddenPhraseInMessages_StringContent(t *testing.T) {
	msgs := []dto.Message{
		{Role: "user", Content: "you are codex and you are Codex too"},
		{Role: "assistant", Content: "no match here"},
	}
	CleanupCodexForbiddenPhraseInMessages(msgs)
	assert.Equal(t, "you are a coding assistant and you are a coding assistant too", msgs[0].Content)
	assert.Equal(t, "no match here", msgs[1].Content)
}

func TestCleanupCodexForbiddenPhraseInMessages_MediaContent(t *testing.T) {
	msgs := []dto.Message{
		{Role: "user", Content: []dto.MediaContent{
			{Type: "text", Text: "you are codex"},
		}},
	}
	CleanupCodexForbiddenPhraseInMessages(msgs)
	mc, ok := msgs[0].Content.([]dto.MediaContent)
	require.True(t, ok)
	assert.Equal(t, "you are a coding assistant", mc[0].Text)
}

func TestCleanupCodexForbiddenPhraseInMessages_ReasoningContent(t *testing.T) {
	msgs := []dto.Message{
		{Role: "assistant", Content: "ok", ReasoningContent: ptrString("you are codex")},
		{Role: "assistant", Content: "ok", Reasoning: ptrString("You Are Codex")},
	}
	CleanupCodexForbiddenPhraseInMessages(msgs)
	require.NotNil(t, msgs[0].ReasoningContent)
	assert.Equal(t, "you are a coding assistant", *msgs[0].ReasoningContent)
	require.NotNil(t, msgs[1].Reasoning)
	assert.Equal(t, "you are a coding assistant", *msgs[1].Reasoning)
}

func TestCleanupCodexForbiddenPhraseInMessages_ToolCalls(t *testing.T) {
	msgs := []dto.Message{
		{Role: "assistant", Content: "", ToolCalls: json.RawMessage(`[{"id":"c1","type":"function","function":{"name":"f","arguments":"you are codex"}}]`)},
	}
	CleanupCodexForbiddenPhraseInMessages(msgs)
	calls := msgs[0].ParseToolCalls()
	require.Len(t, calls, 1)
	assert.Equal(t, "you are a coding assistant", calls[0].Function.Arguments)
}

func TestCleanupCodexForbiddenPhraseInMessages_SliceAnyContent(t *testing.T) {
	msgs := []dto.Message{
		{Role: "user", Content: []any{
			map[string]any{"type": "text", "text": "you are codex"},
			"plain you are codex string",
		}},
	}
	CleanupCodexForbiddenPhraseInMessages(msgs)
	items, ok := msgs[0].Content.([]any)
	require.True(t, ok)
	m := items[0].(map[string]any)
	assert.Equal(t, "you are a coding assistant", m["text"])
	assert.Equal(t, "plain you are a coding assistant string", items[1])
}

func TestCleanupCodexForbiddenPhraseInMessages_NoMatchUnchanged(t *testing.T) {
	original := []dto.Message{
		{Role: "user", Content: "you are the codex"},
		{Role: "user", Content: "codex"},
		{Role: "user", Content: "you are a codex"},
	}
	CleanupCodexForbiddenPhraseInMessages(original)
	assert.Equal(t, "you are the codex", original[0].Content)
	assert.Equal(t, "codex", original[1].Content)
	assert.Equal(t, "you are a codex", original[2].Content)
}

// --- codeBuddyConversationKeyFromRequest ---

func TestCodeBuddyConversationKeyFromRequest_GeneralOpenAIRequest(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{PromptCacheKey: "session-abc"}
	key := codeBuddyConversationKeyFromRequest(req)
	assert.Equal(t, "session-abc", key)
	id := codeBuddyConversationUUID(key)
	assert.NotEmpty(t, id)
	// Same key → stable UUID
	assert.Equal(t, id, codeBuddyConversationUUID(key))
}

func TestCodeBuddyConversationKeyFromRequest_EmptyKey(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{}
	assert.Empty(t, codeBuddyConversationKeyFromRequest(req))
}

func TestCodeBuddyConversationKeyFromRequest_Nil(t *testing.T) {
	assert.Empty(t, codeBuddyConversationKeyFromRequest(nil))
}

func TestCodeBuddyConversationKeyFromRequest_ResponsesRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		PromptCacheKey: json.RawMessage(`"resp-key"`),
	}
	assert.Equal(t, "resp-key", codeBuddyConversationKeyFromRequest(req))
}

func TestCodeBuddyConversationKeyFromRequest_ResponsesRequestFallback(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Conversation: json.RawMessage(`"conv-key"`),
	}
	assert.Equal(t, "conv-key", codeBuddyConversationKeyFromRequest(req))
}
