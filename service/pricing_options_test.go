package service

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func usePricingPatchDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	previousDB := model.DB
	previousOptions := common.OptionMap
	model.DB = db
	common.OptionMap = map[string]string{}
	t.Cleanup(func() { model.DB, common.OptionMap = previousDB, previousOptions })
	require.NoError(t, model.SeedCanonicalPricingOptions())
	return db
}

func expectedMissing() *PricingExpectedValue { return &PricingExpectedValue{Present: false} }

func TestPatchPricingOptionsSetDeleteAndSetIfMissing(t *testing.T) {
	db := usePricingPatchDB(t)
	result, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelPrice", Model: "zero", Action: PricingPatchSet,
		Value: json.RawMessage("0"), Expected: expectedMissing(),
	}})
	require.NoError(t, err)
	var values map[string]json.RawMessage
	require.NoError(t, json.Unmarshal([]byte(result["ModelPrice"]), &values))
	require.Equal(t, "0", string(values["zero"]))

	// set_if_missing must not overwrite an existing value
	_, err = PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelPrice", Model: "zero", Action: PricingPatchSetIfMissing,
		Value: json.RawMessage("1"),
	}})
	require.NoError(t, err)
	var stored model.Option
	require.NoError(t, db.First(&stored, "key = ?", "ModelPrice").Error)
	require.Contains(t, stored.Value, `"zero":0`)

	// delete with correct expected succeeds
	_, err = PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelPrice", Model: "zero", Action: PricingPatchDelete,
		Expected: &PricingExpectedValue{Present: true, Value: json.RawMessage("0")},
	}})
	require.NoError(t, err)

	// delete again with stale expected → conflict
	_, err = PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelPrice", Model: "zero", Action: PricingPatchDelete,
		Expected: &PricingExpectedValue{Present: true, Value: json.RawMessage("0")},
	}})
	require.ErrorIs(t, err, ErrPricingPatchConflict)
}

func TestPatchPricingOptionsIsAtomicOnExpectedConflict(t *testing.T) {
	db := usePricingPatchDB(t)
	// First op would succeed, but second op has a wrong expected → both must roll back
	_, err := PatchPricingOptions([]PricingPatchOperation{
		{
			Key: "ModelPrice", Model: "first", Action: PricingPatchSet,
			Value: json.RawMessage("1"), Expected: expectedMissing(),
		},
		{
			Key: "ModelRatio", Model: "second", Action: PricingPatchSet,
			Value: json.RawMessage("2"),
			Expected: &PricingExpectedValue{Present: true, Value: json.RawMessage("9")},
		},
	})
	require.ErrorIs(t, err, ErrPricingPatchConflict)

	var option model.Option
	require.NoError(t, db.First(&option, "key = ?", "ModelPrice").Error)
	require.NotContains(t, option.Value, "first", "atomic rollback: first op must not be persisted")
}

func TestPatchPricingOptionsMultipleKeysAtomicSuccess(t *testing.T) {
	db := usePricingPatchDB(t)
	result, err := PatchPricingOptions([]PricingPatchOperation{
		{Key: "ModelRatio", Model: "model-a", Action: PricingPatchSet, Value: json.RawMessage("1.5"), Expected: expectedMissing()},
		{Key: "ModelPrice", Model: "model-a", Action: PricingPatchSet, Value: json.RawMessage("0.01"), Expected: expectedMissing()},
		{Key: "CompletionRatio", Model: "model-a", Action: PricingPatchSet, Value: json.RawMessage("2"), Expected: expectedMissing()},
	})
	require.NoError(t, err)

	for _, key := range []string{"ModelRatio", "ModelPrice", "CompletionRatio"} {
		var values map[string]json.RawMessage
		require.NoError(t, json.Unmarshal([]byte(result[key]), &values))
		_, ok := values["model-a"]
		require.True(t, ok, "%s must contain model-a", key)
	}

	// Verify in DB
	var mr model.Option
	require.NoError(t, db.First(&mr, "key = ?", "ModelRatio").Error)
	require.Contains(t, mr.Value, `"model-a":1.5`)
}

func TestPatchPricingOptionsRejectsInvalidKey(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "NonExistentKey", Model: "m", Action: PricingPatchSet,
		Value: json.RawMessage("1"), Expected: expectedMissing(),
	}})
	require.ErrorIs(t, err, ErrPricingPatchValidation)
}

func TestPatchPricingOptionsRejectsEmptyModel(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelRatio", Model: "", Action: PricingPatchSet,
		Value: json.RawMessage("1"), Expected: expectedMissing(),
	}})
	require.ErrorIs(t, err, ErrPricingPatchValidation)
}

func TestPatchPricingOptionsRejectsInvalidAction(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelRatio", Model: "m", Action: "invalid_action",
		Value: json.RawMessage("1"), Expected: expectedMissing(),
	}})
	require.ErrorIs(t, err, ErrPricingPatchValidation)
}

func TestPatchPricingOptionsRequiresExpectedForSet(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelRatio", Model: "m", Action: PricingPatchSet,
		Value: json.RawMessage("1"),
	}})
	require.ErrorIs(t, err, ErrPricingPatchValidation)
}

func TestPatchPricingOptionsRejectsNonScalarValue(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "ModelRatio", Model: "m", Action: PricingPatchSet,
		Value: json.RawMessage(`{"nested":true}`), Expected: expectedMissing(),
	}})
	require.ErrorIs(t, err, ErrPricingPatchValidation)
}

func TestPatchPricingOptionsBillingExprAcceptsString(t *testing.T) {
	usePricingPatchDB(t)
	_, err := PatchPricingOptions([]PricingPatchOperation{{
		Key: "billing_setting.billing_expr", Model: "model-x", Action: PricingPatchSetIfMissing,
		Value: json.RawMessage(`"expr_string"`),
	}})
	require.NoError(t, err)
}

func TestPatchPricingOptionsRejectsEmptyOperations(t *testing.T) {
	usePricingPatchDB(t)
	_, _, err := PatchPricingOptionsWithApplied(nil)
	require.Error(t, err)
}
