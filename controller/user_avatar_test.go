package controller

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeAvatarURL(t *testing.T) {
	jpegBytes := []byte{0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43}
	jpegDataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(jpegBytes)

	tests := []struct {
		name      string
		input     string
		expected  string
		wantError bool
	}{
		{name: "empty removes avatar", input: "  ", expected: ""},
		{name: "https external avatar", input: "https://cdn.example.com/avatar.png", expected: "https://cdn.example.com/avatar.png"},
		{name: "http external avatar", input: "http://cdn.example.com/avatar.png", expected: "http://cdn.example.com/avatar.png"},
		{name: "jpeg data URL", input: jpegDataURL, expected: jpegDataURL},
		{name: "reject javascript URL", input: "javascript:alert(1)", wantError: true},
		{name: "reject SVG data URL", input: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", wantError: true},
		{name: "reject mismatched image data", input: "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString([]byte("not-jpeg")), wantError: true},
		{name: "reject URL credentials", input: "https://user:pass@example.com/avatar.png", wantError: true},
		{name: "reject oversized external URL", input: "https://example.com/" + strings.Repeat("a", avatarMaxExternalURLLength), wantError: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			actual, err := normalizeAvatarURL(test.input)
			if test.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.expected, actual)
		})
	}
}
