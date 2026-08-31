package controller

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

func TestSyncOAuthAvatar(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))

	previousDB := model.DB
	previousRedisEnabled := common.RedisEnabled
	model.DB = db
	common.RedisEnabled = false
	t.Cleanup(func() {
		model.DB = previousDB
		common.RedisEnabled = previousRedisEnabled
	})

	user := model.User{
		Username:    "oauth_avatar_user",
		DisplayName: "OAuth Avatar User",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
	user.SetSetting(dto.UserSetting{
		Language:  "zh",
		AvatarUrl: "https://cdn.example.com/old.png",
	})
	require.NoError(t, db.Create(&user).Error)

	t.Run("valid avatar updates and preserves other settings", func(t *testing.T) {
		syncOAuthAvatar(&user, " https://cdn.example.com/new.png ")

		var stored model.User
		require.NoError(t, db.First(&stored, user.Id).Error)
		settings := stored.GetSetting()
		assert.Equal(t, "https://cdn.example.com/new.png", settings.AvatarUrl)
		assert.Equal(t, "zh", settings.Language)
		assert.Equal(t, settings, user.GetSetting())
	})

	t.Run("empty and invalid avatars leave current avatar unchanged", func(t *testing.T) {
		syncOAuthAvatar(&user, "")
		syncOAuthAvatar(&user, "javascript:alert(1)")

		var stored model.User
		require.NoError(t, db.First(&stored, user.Id).Error)
		assert.Equal(t, "https://cdn.example.com/new.png", stored.GetSetting().AvatarUrl)
	})
}
