package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func usePricingOptionDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Option{}))
	previousDB := DB
	previousOptions := common.OptionMap
	DB = db
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { DB, common.OptionMap = previousDB, previousOptions })
	return db
}

func TestSeedCanonicalPricingOptionsOnlyAddsMissingRows(t *testing.T) {
	db := usePricingOptionDB(t)

	// Pre-insert a user-configured ModelRatio that must NOT be overwritten
	userValue := `{"custom-model":2.5}`
	require.NoError(t, db.Create(&Option{Key: "ModelRatio", Value: userValue}).Error)

	require.NoError(t, SeedCanonicalPricingOptions())

	// ModelRatio must retain the user value
	var stored Option
	require.NoError(t, db.First(&stored, "key = ?", "ModelRatio").Error)
	require.Equal(t, userValue, stored.Value, "existing ModelRatio must not be overwritten by seed")

	// All canonical keys must exist
	for _, key := range PricingOptionKeys {
		var opt Option
		require.NoError(t, db.First(&opt, "key = ?", key).Error, "canonical key %q must exist after seed", key)
	}
}

func TestSeedCanonicalPricingOptionsIsIdempotent(t *testing.T) {
	db := usePricingOptionDB(t)
	require.NoError(t, SeedCanonicalPricingOptions())
	require.NoError(t, SeedCanonicalPricingOptions())

	var count int64
	require.NoError(t, db.Model(&Option{}).Where("key IN ?", PricingOptionKeys).Count(&count).Error)
	require.Equal(t, int64(len(PricingOptionKeys)), count, "seed must not create duplicates")
}

func TestRefreshPricingOptionMapsFromDatabasePublishesAllKeys(t *testing.T) {
	usePricingOptionDB(t)
	require.NoError(t, SeedCanonicalPricingOptions())

	values, err := RefreshPricingOptionMapsFromDatabase()
	require.NoError(t, err)
	require.Len(t, values, len(PricingOptionKeys))
	for _, key := range PricingOptionKeys {
		_, ok := values[key]
		require.True(t, ok, "key %q must be in refreshed values", key)
		// OptionMap must also be updated
		_, ok = common.OptionMap[key]
		require.True(t, ok, "key %q must be in OptionMap after refresh", key)
	}
}

func TestRefreshPricingOptionMapsFailsOnMissingCanonicalRow(t *testing.T) {
	usePricingOptionDB(t)
	// Don't seed — all canonical rows are missing
	_, err := RefreshPricingOptionMapsFromDatabase()
	require.Error(t, err)
	require.ErrorIs(t, err, ErrPricingOptionIntegrity)
}

func TestIsPricingOptionKey(t *testing.T) {
	require.True(t, IsPricingOptionKey("ModelRatio"))
	require.True(t, IsPricingOptionKey("billing_setting.billing_mode"))
	require.False(t, IsPricingOptionKey("NonExistentKey"))
}
