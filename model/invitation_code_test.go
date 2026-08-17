package model

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationCodeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&InvitationCode{}))

	previousDB := DB
	previousKeyCol := commonKeyCol
	DB = db
	commonKeyCol = "`key`"
	t.Cleanup(func() {
		DB = previousDB
		commonKeyCol = previousKeyCol
	})
	return db
}

func TestUseInvitationCodeWithTxFollowsTransactionOutcome(t *testing.T) {
	db := setupInvitationCodeTestDB(t)

	t.Run("commit consumes code exactly once", func(t *testing.T) {
		code := InvitationCode{
			Key:    "commit-code",
			Name:   "commit",
			Status: common.InvitationCodeStatusEnabled,
		}
		require.NoError(t, db.Create(&code).Error)

		require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
			return UseInvitationCodeWithTx(tx, code.Key, 42)
		}))

		var stored InvitationCode
		require.NoError(t, db.First(&stored, code.Id).Error)
		assert.Equal(t, common.InvitationCodeStatusUsed, stored.Status)
		assert.Equal(t, 42, stored.UsedUserId)
		assert.Positive(t, stored.UsedTime)

		err := db.Transaction(func(tx *gorm.DB) error {
			return UseInvitationCodeWithTx(tx, code.Key, 99)
		})
		require.ErrorIs(t, err, ErrInvitationCodeUnavailable)
	})

	t.Run("rollback keeps code available", func(t *testing.T) {
		code := InvitationCode{
			Key:    "rollback-code",
			Name:   "rollback",
			Status: common.InvitationCodeStatusEnabled,
		}
		require.NoError(t, db.Create(&code).Error)

		rollbackErr := errors.New("rollback registration")
		err := db.Transaction(func(tx *gorm.DB) error {
			require.NoError(t, UseInvitationCodeWithTx(tx, code.Key, 77))
			return rollbackErr
		})
		require.ErrorIs(t, err, rollbackErr)

		var stored InvitationCode
		require.NoError(t, db.First(&stored, code.Id).Error)
		assert.Equal(t, common.InvitationCodeStatusEnabled, stored.Status)
		assert.Zero(t, stored.UsedUserId)
		assert.Zero(t, stored.UsedTime)
	})
}

func TestUserInvitationCodeOperationsEnforceOwnership(t *testing.T) {
	db := setupInvitationCodeTestDB(t)
	userOneEnabled := InvitationCode{UserId: 1, Key: "user-one-enabled", Status: common.InvitationCodeStatusEnabled}
	userOneUsed := InvitationCode{UserId: 1, Key: "user-one-used", Status: common.InvitationCodeStatusUsed}
	userTwoEnabled := InvitationCode{UserId: 2, Key: "user-two-enabled", Status: common.InvitationCodeStatusEnabled}
	userTwoUsed := InvitationCode{UserId: 2, Key: "user-two-used", Status: common.InvitationCodeStatusUsed}
	require.NoError(t, db.Create(&userOneEnabled).Error)
	require.NoError(t, db.Create(&userOneUsed).Error)
	require.NoError(t, db.Create(&userTwoEnabled).Error)
	require.NoError(t, db.Create(&userTwoUsed).Error)

	codes, total, err := GetUserInvitationCodes(1, 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	require.Len(t, codes, 2)
	for _, code := range codes {
		assert.Equal(t, 1, code.UserId)
	}

	keys, err := GetUserAvailableInvitationCodeKeys(1)
	require.NoError(t, err)
	assert.Equal(t, []string{userOneEnabled.Key}, keys)

	deleted, err := DeleteUserInvitationCodes(1, []int{userOneEnabled.Id, userTwoEnabled.Id})
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)
	assert.NoError(t, db.First(&InvitationCode{}, userTwoEnabled.Id).Error)

	deleted, err = DeleteUserUsedInvitationCodes(1)
	require.NoError(t, err)
	assert.EqualValues(t, 1, deleted)
	assert.NoError(t, db.First(&InvitationCode{}, userTwoUsed.Id).Error)
}
