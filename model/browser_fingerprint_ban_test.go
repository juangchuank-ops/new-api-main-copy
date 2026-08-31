package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupBrowserFingerprintBanTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&BrowserFingerprintBan{}))
	previousDB := DB
	DB = db
	InvalidateBrowserFingerprintBanSnapshot()
	t.Cleanup(func() {
		DB = previousDB
		InvalidateBrowserFingerprintBanSnapshot()
	})
}

func TestBrowserFingerprintBanCRUDMatchingExpiryAndToggle(t *testing.T) {
	setupBrowserFingerprintBanTestDB(t)
	fingerprint := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	now := time.Unix(2_000_000_000, 0)
	ban := &BrowserFingerprintBan{FingerprintHash: fingerprint, Reason: "abuse", Enabled: true, OperatorId: 7}
	require.NoError(t, CreateBrowserFingerprintBan(ban))
	assert.Equal(t, fingerprint, ban.FingerprintHash)

	matched, err := MatchBrowserFingerprint(fingerprint, now)
	require.NoError(t, err)
	require.NotNil(t, matched)
	assert.Equal(t, "abuse", matched.Reason)
	assert.Nil(t, mustMatchBrowserFingerprint(t, "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd", now))

	updated, err := UpdateBrowserFingerprintBan(int(ban.Id), fingerprint, "updated", true, now.Unix()-1, 0, 8)
	require.NoError(t, err)
	assert.Equal(t, 8, updated.OperatorId)
	matched, err = MatchBrowserFingerprint(fingerprint, now)
	require.NoError(t, err)
	assert.Nil(t, matched)

	toggled, err := ToggleBrowserFingerprintBan(ban.Id, 9)
	require.NoError(t, err)
	assert.False(t, toggled.Enabled)

	require.NoError(t, DeleteBrowserFingerprintBan(ban.Id))
	_, err = GetBrowserFingerprintBanByID(ban.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func mustMatchBrowserFingerprint(t *testing.T, fingerprint string, now time.Time) *BrowserFingerprintBan {
	t.Helper()
	matched, err := MatchBrowserFingerprint(fingerprint, now)
	require.NoError(t, err)
	return matched
}

func TestNormalizeBrowserFingerprintHashRejectsInvalidValues(t *testing.T) {
	_, err := NormalizeBrowserFingerprintHash("not-a-hash")
	require.Error(t, err)
	_, err = NormalizeBrowserFingerprintHash("0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF")
	require.NoError(t, err)
}
