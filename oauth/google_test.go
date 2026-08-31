package oauth

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGoogleIdentityDerivation(t *testing.T) {
	tests := []struct {
		name         string
		email        string
		userInfo     googleUser
		wantUsername string
		wantDisplay  string
	}{
		{
			name:         "full identity from email",
			email:        "alice@example.com",
			userInfo:     googleUser{ID: "1", Email: "alice@example.com", Name: "Alice"},
			wantUsername: "alice",
			wantDisplay:  "Alice",
		},
		{
			name:         "no name falls back to email prefix",
			email:        "bob@example.com",
			userInfo:     googleUser{ID: "2", Email: "bob@example.com"},
			wantUsername: "bob",
			wantDisplay:  "bob",
		},
		{
			name:         "email without at sign stays whole",
			email:        "plain",
			userInfo:     googleUser{ID: "3", Email: "plain"},
			wantUsername: "plain",
			wantDisplay:  "plain",
		},
		{
			name:         "empty email derives nothing",
			email:        "",
			userInfo:     googleUser{ID: "4", Name: "Carol"},
			wantUsername: "",
			wantDisplay:  "Carol",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.wantUsername, googleUsernameFromEmail(test.email))
			assert.Equal(t, test.wantDisplay, googleDisplayName(test.userInfo))
		})
	}
}
