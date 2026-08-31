package model

import (
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupIPBanTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&IPBan{}, &User{}, &Log{}))
	previousDB := DB
	previousLogDB := LOG_DB
	DB = db
	LOG_DB = db
	InvalidateIPBanSnapshot()
	t.Cleanup(func() {
		DB = previousDB
		LOG_DB = previousLogDB
		InvalidateIPBanSnapshot()
	})
}

func TestCanonicalizeIPBanRule(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr bool
	}{
		{name: "IPv4", input: " 192.0.2.1 ", want: "192.0.2.1"},
		{name: "IPv6", input: "2001:0db8::1", want: "2001:db8::1"},
		{name: "CIDR masks host bits", input: "192.0.2.99/24", want: "192.0.2.0/24"},
		{name: "IPv6 CIDR", input: "2001:db8::abcd/48", want: "2001:db8::/48"},
		{name: "rejects zone", input: "fe80::1%eth0", wantErr: true},
		{name: "rejects malformed", input: "192.0.2.999", wantErr: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := CanonicalizeIPBanRule(test.input)
			if test.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}

func TestIPBanCRUDMatchingExpiryAndInvalidation(t *testing.T) {
	setupIPBanTestDB(t)
	now := time.Unix(2_000_000_000, 0)
	ban := &IPBan{Rule: "192.0.2.19/24", Reason: "abuse", Enabled: true, OperatorId: 7}
	require.NoError(t, CreateIPBan(ban))
	assert.Equal(t, "192.0.2.0/24", ban.Rule)

	banned, err := IsIPBanned("192.0.2.42", now)
	require.NoError(t, err)
	assert.True(t, banned)
	banned, err = IsIPBanned("198.51.100.1", now)
	require.NoError(t, err)
	assert.False(t, banned)

	updated, err := UpdateIPBan(ban.Id, "2001:db8::1", "updated", true, now.Unix()-1, 0, 8)
	require.NoError(t, err)
	assert.Equal(t, 8, updated.OperatorId)
	banned, err = IsIPBanned("192.0.2.42", now)
	require.NoError(t, err)
	assert.False(t, banned)
	banned, err = IsIPBanned("2001:db8::1", now)
	require.NoError(t, err)
	assert.False(t, banned)

	updated, err = UpdateIPBan(ban.Id, "2001:db8::1", "updated", true, 0, 0, 8)
	require.NoError(t, err)
	banned, err = IsIPBanned("2001:db8::1", now)
	require.NoError(t, err)
	assert.True(t, banned)

	toggled, err := ToggleIPBan(ban.Id, 9)
	require.NoError(t, err)
	assert.False(t, toggled.Enabled)
	banned, err = IsIPBanned("2001:db8::1", now)
	require.NoError(t, err)
	assert.False(t, banned)

	require.NoError(t, DeleteIPBan(ban.Id))
	_, err = GetIPBanByID(ban.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestListIPBansPaginationAndSearch(t *testing.T) {
	setupIPBanTestDB(t)
	for _, ban := range []*IPBan{
		{Rule: "192.0.2.1", Reason: "first abuse", Enabled: true, OperatorId: 1},
		{Rule: "198.51.100.0/24", Reason: "second", Enabled: true, OperatorId: 1},
		{Rule: "2001:db8::1", Reason: "third abuse", Enabled: false, OperatorId: 1},
	} {
		require.NoError(t, CreateIPBan(ban))
	}
	bans, total, err := ListIPBans(0, 1, "abuse")
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, bans, 1)
	assert.Equal(t, "2001:db8::1", bans[0].Rule)
}

func TestListIPBanUsersReturnsCanonicalLoginIPs(t *testing.T) {
	setupIPBanTestDB(t)
	users := []User{
		{Username: "alice", Password: "password", DisplayName: "Alice", Email: "alice@example.com", AffCode: "alice-code"},
		{Username: "deleted", Password: "password", DisplayName: "Deleted", Email: "deleted@example.com", AffCode: "deleted-code"},
	}
	require.NoError(t, DB.Create(&users).Error)
	require.NoError(t, DB.Delete(&users[1]).Error)
	require.NoError(t, LOG_DB.Create(&[]Log{
		{UserId: users[0].Id, Type: LogTypeLogin, Ip: "invalid", CreatedAt: 50},
		{UserId: users[0].Id, Type: LogTypeLogin, Ip: "::1", CreatedAt: 40},
		{UserId: users[0].Id, Type: LogTypeLogin, Ip: "2001:0db8::1", CreatedAt: 30},
		{UserId: users[0].Id, Type: LogTypeLogin, Ip: "2001:db8::1", CreatedAt: 20},
		{UserId: users[0].Id, Type: LogTypeConsume, Ip: "192.0.2.1", CreatedAt: 60},
	}).Error)

	result, total, err := ListIPBanUsers("alice", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, result, 1)
	assert.Equal(t, users[0].Id, result[0].Id)
	assert.Equal(t, "alice", result[0].Username)
	assert.Equal(t, "Alice", result[0].DisplayName)
	assert.Equal(t, "alice@example.com", result[0].Email)
	assert.Equal(t, []IPBanUserLoginIP{{IP: "2001:db8::1", LastSeenAt: 30}}, result[0].IPs)

	result, total, err = ListIPBanUsers("deleted", 0, 10)
	require.NoError(t, err)
	assert.Zero(t, total)
	assert.Empty(t, result)
}

func TestCreateIPBanValidatesTargetUserLoginIP(t *testing.T) {
	setupIPBanTestDB(t)
	user := User{Username: "alice", Password: "password", DisplayName: "Alice"}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, LOG_DB.Create(&Log{
		UserId: user.Id, Type: LogTypeLogin, Ip: "2001:0db8::1", CreatedAt: 10,
	}).Error)

	ban := &IPBan{
		Rule: "2001:db8::1", Reason: "abuse", Enabled: true, TargetUserId: user.Id, OperatorId: 7,
	}
	require.NoError(t, CreateIPBan(ban))
	assert.Equal(t, user.Username, ban.TargetUsername)
	matched, err := MatchIPBan("2001:db8::1", time.Now())
	require.NoError(t, err)
	require.NotNil(t, matched)
	assert.Equal(t, "abuse", matched.Reason)
	assert.Equal(t, user.Id, matched.TargetUserId)
	assert.Equal(t, user.Username, matched.TargetUsername)

	err = CreateIPBan(&IPBan{
		Rule: "192.0.2.1", Reason: "wrong user IP", Enabled: true, TargetUserId: user.Id,
	})
	assert.ErrorContains(t, err, "not a successful login IP")

	err = CreateIPBan(&IPBan{
		Rule: "192.0.2.0/24", Reason: "target CIDR", Enabled: true, TargetUserId: user.Id,
	})
	assert.ErrorContains(t, err, "CIDR rules cannot target a user")

	manual := &IPBan{Rule: "192.0.2.0/24", Reason: "manual CIDR", Enabled: true}
	require.NoError(t, CreateIPBan(manual))
	assert.Zero(t, manual.TargetUserId)
	assert.Empty(t, manual.TargetUsername)
}
