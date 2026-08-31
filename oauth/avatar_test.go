package oauth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDiscordAvatarURL(t *testing.T) {
	tests := []struct {
		name     string
		userID   string
		hash     string
		expected string
	}{
		{name: "static avatar", userID: "123", hash: "abc", expected: "https://cdn.discordapp.com/avatars/123/abc.png"},
		{name: "animated avatar", userID: "123", hash: "a_abc", expected: "https://cdn.discordapp.com/avatars/123/a_abc.gif"},
		{name: "missing avatar", userID: "123", expected: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, discordAvatarURL(test.userID, test.hash))
		})
	}
}

func TestLinuxDOAvatarURL(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{name: "relative template", input: "/user_avatar/linux.do/name/{size}/1.png", expected: "https://linux.do/user_avatar/linux.do/name/120/1.png"},
		{name: "scheme relative template", input: "//cdn.example.com/avatar/{size}.png", expected: "https://cdn.example.com/avatar/120.png"},
		{name: "absolute template", input: "https://cdn.example.com/avatar/{size}.png", expected: "https://cdn.example.com/avatar/120.png"},
		{name: "missing avatar", expected: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, linuxdoAvatarURL(test.input))
		})
	}
}
