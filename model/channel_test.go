package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/require"
)


func TestNormalizeChannelBaseURL(t *testing.T) {
	tests := []struct {
		name  string
		raw   string
		cType int
		want  string
	}{
		{name: "openai bare host gets v1 suffix", raw: "https://test.test.com", cType: 1, want: "https://test.test.com"},
		{name: "trailing slash", raw: "https://test.test.com/", cType: 1, want: "https://test.test.com"},
		{name: "incomplete v fragment", raw: "https://test.test.com/v", cType: 1, want: "https://test.test.com"},
		{name: "v1 fragment", raw: "https://test.test.com/v1", cType: 1, want: "https://test.test.com"},
		{name: "v1 with trailing slash", raw: "https://test.test.com/v1/", cType: 1, want: "https://test.test.com"},
		{name: "uppercase fragment", raw: "https://test.test.com/V1/", cType: 1, want: "https://test.test.com"},
		{name: "claude v1 fragment", raw: "https://proxy.example/v1/", cType: 14, want: "https://proxy.example"},
		{name: "gemini v1beta fragment", raw: "https://g.example/v1beta/", cType: 24, want: "https://g.example"},
		{name: "gemini v1 fragment", raw: "https://g.example/v1", cType: 24, want: "https://g.example"},
		{name: "custom path kept", raw: "https://test.test.com/api", cType: 1, want: "https://test.test.com/api"},
		{name: "versioned v2 path kept", raw: "https://test.test.com/v2", cType: 1, want: "https://test.test.com/v2"},
		{name: "nested custom path kept", raw: "https://openrouter.ai/api", cType: 1, want: "https://openrouter.ai/api"},
		{name: "port host untouched", raw: "http://localhost:11434", cType: 4, want: "http://localhost:11434"},
		{name: "custom type kept verbatim", raw: "https://x.example/v1/chat/completions", cType: 8, want: "https://x.example/v1/chat/completions"},
		{name: "advanced custom kept verbatim", raw: "https://x.example/v1", cType: 58, want: "https://x.example/v1"},
		{name: "midjourney kept verbatim", raw: "https://x.example/v1", cType: 2, want: "https://x.example/v1"},
		{name: "empty value", raw: "", cType: 1, want: ""},
		{name: "trailing spaces trimmed", raw: "  https://test.test.com/v1/  ", cType: 1, want: "https://test.test.com"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeChannelBaseURL(tt.raw, tt.cType)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestNormalizeChannelBaseURLFullRequestURLSkipped(t *testing.T) {
	channel := &Channel{
		Type:    1,
		BaseURL: common.GetPointer("https://x.example/v1/chat/completions"),
		Setting: common.GetPointer(`{"full_request_url":true}`),
	}
	require.Equal(t, "https://x.example/v1/chat/completions", channel.GetBaseURL())

	channel.BaseURL = common.GetPointer("https://x.example/v1")
	channel.Setting = common.GetPointer(`{}`)
	require.Equal(t, "https://x.example", channel.GetBaseURL())
}
