package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChannelType2APIType_CodeBuddy(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeCodeBuddy)
	require.True(t, ok)
	assert.Equal(t, constant.APITypeOpenAI, apiType)
}

func TestChannelType2APIType_CodexCompatibility(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeCodexCompatibility)
	require.True(t, ok)
	assert.Equal(t, constant.APITypeOpenAI, apiType)
}

func TestChannelType2APIType_ClaudeCode(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeClaudeCode)
	require.True(t, ok)
	assert.Equal(t, constant.APITypeAnthropic, apiType)
}
