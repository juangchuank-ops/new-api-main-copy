package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

// The classic theme used to forward four UI-only form fields to
// PUT /api/channel/, which the admin patch whitelist rejected with
// "invalid channel admin patch field" and blocked every channel save.
func TestChannelAdminPatchRejectsClassicUIOnlyFields(t *testing.T) {
	for _, field := range []string{"max_input_tokens", "groups", "azure_responses_version", "full_request_url"} {
		t.Run(field, func(t *testing.T) {
			db := setupChannelMutationDB(t, true)
			enableMutationSync(t, db)
			created, err := CreateChannels([]model.Channel{{Key: "secret", Models: "a", Group: "default", Status: common.ChannelStatusEnabled}}, ChannelMutationTriggerCreate)
			require.NoError(t, err)

			_, err = UpdateChannelAdminPatch(ChannelAdminPatchInput{
				ChannelID:        created[0].Id,
				ExpectedRevision: created[0].ConfigRevision,
				Patch:            model.Channel{Name: "renamed"},
				Fields:           map[string]bool{"name": true, field: true},
				Trigger:          ChannelMutationTriggerUpdate,
			})
			require.EqualError(t, err, "invalid channel admin patch field")

			var stored model.Channel
			require.NoError(t, db.First(&stored, created[0].Id).Error)
			require.Equal(t, "", stored.Name, "rejected patch must not partially apply")
		})
	}
}

// The payload the fixed classic theme now sends must be accepted and persist.
func TestChannelAdminPatchAcceptsFixedClassicPayload(t *testing.T) {
	db := setupChannelMutationDB(t, true)
	enableMutationSync(t, db)
	created, err := CreateChannels([]model.Channel{{Key: "secret", Models: "a", Group: "default", Status: common.ChannelStatusEnabled}}, ChannelMutationTriggerCreate)
	require.NoError(t, err)

	fields := map[string]bool{
		"name": true, "type": true, "key": true, "openai_organization": true,
		"base_url": true, "other": true, "model_mapping": true, "param_override": true,
		"status_code_mapping": true, "models": true, "auto_ban": true, "test_model": true,
		"group": true, "priority": true, "weight": true, "tag": true,
		"multi_key_mode": true, "settings": true,
	}

	otherSettings := `{"full_request_url":true,"azure_responses_version":"preview"}`
	_, err = UpdateChannelAdminPatch(ChannelAdminPatchInput{
		ChannelID:        created[0].Id,
		ExpectedRevision: created[0].ConfigRevision,
		Patch: model.Channel{
			Name:          "renamed",
			Models:        "gpt-6-luna",
			Group:         "default",
			OtherSettings: otherSettings,
		},
		Fields:  fields,
		Trigger: ChannelMutationTriggerUpdate,
	})
	require.NoError(t, err)

	var stored model.Channel
	require.NoError(t, db.First(&stored, created[0].Id).Error)
	require.Equal(t, "renamed", stored.Name)
	require.Equal(t, "gpt-6-luna", stored.Models)
	require.JSONEq(t, otherSettings, stored.OtherSettings)
}
