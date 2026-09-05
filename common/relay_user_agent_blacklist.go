package common

import (
	"fmt"
	"regexp"
	"strings"
	"sync/atomic"
)

// Actions taken when a request's User-Agent matches the blacklist.
const (
	// RelayUserAgentBlacklistAction403 only rejects the current request.
	RelayUserAgentBlacklistAction403 = "403"
	// RelayUserAgentBlacklistActionBan bans the account immediately and
	// answers with the ban response.
	RelayUserAgentBlacklistActionBan = "ban"
	// RelayUserAgentBlacklistActionRejectBan bans the account immediately and
	// answers with a plain access-denied response.
	RelayUserAgentBlacklistActionRejectBan = "reject_ban"
	// RelayUserAgentBlacklistActionBanIP bans the account and blocks every IP
	// the account has logged in from.
	RelayUserAgentBlacklistActionBanIP = "reject_ban_ip"
)

// NormalizeRelayUserAgentBlacklistAction maps unknown or empty action values
// to the default reject-only action.
func NormalizeRelayUserAgentBlacklistAction(action string) string {
	switch strings.TrimSpace(action) {
	case RelayUserAgentBlacklistActionBan,
		RelayUserAgentBlacklistActionRejectBan,
		RelayUserAgentBlacklistActionBanIP:
		return strings.TrimSpace(action)
	default:
		return RelayUserAgentBlacklistAction403
	}
}

type relayUserAgentPattern struct {
	source string
	re     *regexp.Regexp
}

type relayUserAgentBlacklistConfig struct {
	enabled  bool
	action   string
	patterns []relayUserAgentPattern
}

var relayUserAgentBlacklist atomic.Pointer[relayUserAgentBlacklistConfig]

// relayUserAgentMetaChars lists regular expression metacharacters. A
// blacklist line containing any of them is matched as a regular expression;
// every other line is matched as a case-insensitive substring.
const relayUserAgentMetaChars = `\.^$*+?()[]{}|`

func compileRelayUserAgentPattern(pattern string) (*regexp.Regexp, error) {
	if strings.ContainsAny(pattern, relayUserAgentMetaChars) {
		return regexp.Compile(pattern)
	}
	return regexp.Compile("(?i)" + regexp.QuoteMeta(pattern))
}

// NormalizeRelayUserAgentBlacklist trims, removes empty and duplicate lines,
// and verifies that every remaining line is a plain-text substring or a valid
// Go RE2 regular expression.
func NormalizeRelayUserAgentBlacklist(value string) (string, error) {
	patterns := make([]string, 0)
	seen := make(map[string]struct{})
	for lineNumber, line := range strings.Split(value, "\n") {
		pattern := strings.TrimSpace(line)
		if pattern == "" {
			continue
		}
		if _, ok := seen[pattern]; ok {
			continue
		}
		if _, err := compileRelayUserAgentPattern(pattern); err != nil {
			return "", fmt.Errorf("invalid RelayUserAgentBlacklist pattern on line %d: %w", lineNumber+1, err)
		}
		seen[pattern] = struct{}{}
		patterns = append(patterns, pattern)
	}
	return strings.Join(patterns, "\n"), nil
}

// SetRelayUserAgentBlacklistConfig replaces the complete immutable matcher
// snapshot so requests never compile regular expressions.
func SetRelayUserAgentBlacklistConfig(enabled bool, value string, action string) (string, error) {
	normalized, err := NormalizeRelayUserAgentBlacklist(value)
	if err != nil {
		return "", err
	}

	patterns := make([]relayUserAgentPattern, 0)
	if normalized != "" {
		for _, pattern := range strings.Split(normalized, "\n") {
			compiled, err := compileRelayUserAgentPattern(pattern)
			if err != nil {
				return "", err
			}
			patterns = append(patterns, relayUserAgentPattern{source: pattern, re: compiled})
		}
	}
	relayUserAgentBlacklist.Store(&relayUserAgentBlacklistConfig{
		enabled:  enabled,
		action:   NormalizeRelayUserAgentBlacklistAction(action),
		patterns: patterns,
	})
	return normalized, nil
}

func IsRelayUserAgentBlacklisted(userAgent string) bool {
	_, matched := MatchRelayUserAgentBlacklist(userAgent)
	return matched
}

// RelayUserAgentBlacklistAction returns the configured action for blacklist
// hits. It is meaningful only while the blacklist is enabled.
func RelayUserAgentBlacklistAction() string {
	config := relayUserAgentBlacklist.Load()
	if config == nil {
		return RelayUserAgentBlacklistAction403
	}
	return config.action
}

func MatchRelayUserAgentBlacklist(userAgent string) (string, bool) {
	config := relayUserAgentBlacklist.Load()
	if config == nil || !config.enabled {
		return "", false
	}
	for _, pattern := range config.patterns {
		if pattern.re.MatchString(userAgent) {
			return pattern.source, true
		}
	}
	return "", false
}
