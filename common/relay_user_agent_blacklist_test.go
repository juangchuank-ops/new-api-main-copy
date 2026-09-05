package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMatchRelayUserAgentBlacklist(t *testing.T) {
	tests := []struct {
		name        string
		enabled     bool
		config      string
		action      string
		userAgent   string
		wantMatched bool
		wantPattern string
	}{
		{
			name:        "plain text matches case-insensitively",
			enabled:     true,
			config:      "Go-http-client",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "go-http-client/2.0",
			wantMatched: true,
			wantPattern: "Go-http-client",
		},
		{
			name:        "plain text matches as substring",
			enabled:     true,
			config:      "python-requests",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "Mozilla/5.0 (compatible; Python-Requests/2.31)",
			wantMatched: true,
			wantPattern: "python-requests",
		},
		{
			name:        "plain text without match",
			enabled:     true,
			config:      "Go-http-client",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
			wantMatched: false,
			wantPattern: "",
		},
		{
			name:        "metacharacter line is treated as regex and stays case-sensitive",
			enabled:     true,
			config:      "Go-http-client/2.0",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "go-http-client/2.0",
			wantMatched: false,
			wantPattern: "",
		},
		{
			name:        "regex matches literal self",
			enabled:     true,
			config:      "Go-http-client/2.0",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "Go-http-client/2.0",
			wantMatched: true,
			wantPattern: "Go-http-client/2.0",
		},
		{
			name:        "anchored regex rejects non-prefix match",
			enabled:     true,
			config:      "^curl/[0-9]",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "xCurl/8.4.0",
			wantMatched: false,
			wantPattern: "",
		},
		{
			name:        "anchored regex accepts prefix match",
			enabled:     true,
			config:      "^curl/[0-9]",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "curl/8.4.0",
			wantMatched: true,
			wantPattern: "^curl/[0-9]",
		},
		{
			name:        "empty and duplicate lines are ignored",
			enabled:     true,
			config:      "Go-http-client\n\nGo-http-client\n",
			action:      RelayUserAgentBlacklistAction403,
			userAgent:   "Go-http-Client/2.0",
			wantMatched: true,
			wantPattern: "Go-http-client",
		},
		{
			name:        "disabled config never matches",
			enabled:     false,
			config:      "Go-http-client",
			action:      RelayUserAgentBlacklistActionBan,
			userAgent:   "Go-http-client/2.0",
			wantMatched: false,
			wantPattern: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := SetRelayUserAgentBlacklistConfig(tt.enabled, tt.config, tt.action)
			require.NoError(t, err)
			defer func() {
				_, err := SetRelayUserAgentBlacklistConfig(false, "", RelayUserAgentBlacklistAction403)
				require.NoError(t, err)
			}()

			pattern, matched := MatchRelayUserAgentBlacklist(tt.userAgent)
			assert.Equal(t, tt.wantMatched, matched)
			assert.Equal(t, tt.wantPattern, pattern)
			if tt.enabled {
				assert.Equal(t, tt.action, RelayUserAgentBlacklistAction())
			}
		})
	}
}

func TestNormalizeRelayUserAgentBlacklistAction(t *testing.T) {
	assert.Equal(t, RelayUserAgentBlacklistAction403, NormalizeRelayUserAgentBlacklistAction(""))
	assert.Equal(t, RelayUserAgentBlacklistAction403, NormalizeRelayUserAgentBlacklistAction("unknown"))
	assert.Equal(t, RelayUserAgentBlacklistAction403, NormalizeRelayUserAgentBlacklistAction(" 403 "))
	assert.Equal(t, RelayUserAgentBlacklistActionBan, NormalizeRelayUserAgentBlacklistAction("ban"))
	assert.Equal(t, RelayUserAgentBlacklistActionRejectBan, NormalizeRelayUserAgentBlacklistAction("reject_ban"))
	assert.Equal(t, RelayUserAgentBlacklistActionBanIP, NormalizeRelayUserAgentBlacklistAction("reject_ban_ip"))
}

func TestNormalizeRelayUserAgentBlacklistNormalizesLines(t *testing.T) {
	normalized, err := NormalizeRelayUserAgentBlacklist("  Go-http-client  \n\nGo-http-client\npython-requests\n")
	require.NoError(t, err)
	assert.Equal(t, "Go-http-client\npython-requests", normalized)
}

func TestNormalizeRelayUserAgentBlacklistRejectsInvalidRegex(t *testing.T) {
	_, err := NormalizeRelayUserAgentBlacklist("Go-http-client\n^curl/[0-9")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "line 2")
}
