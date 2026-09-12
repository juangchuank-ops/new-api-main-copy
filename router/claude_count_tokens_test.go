package router

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestClaudeCountTokensPreservesRequestAndQuota(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Channel{}, &model.Ability{}, &model.Log{}, &model.UserSubscription{}, &model.SubscriptionPlan{}))
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousCache, previousBatch, previousLogs, previousRedis := common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled
	previousCount := constant.CountToken
	previousRatios := ratio_setting.ModelRatio2JSONString()
	model.DB, model.LOG_DB = db, db
	common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled = false, false, false, false
	constant.CountToken = false
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"claude-count-fixture":1}`))
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.MemoryCacheEnabled, common.BatchUpdateEnabled, common.LogConsumeEnabled, common.RedisEnabled = previousCache, previousBatch, previousLogs, previousRedis
		constant.CountToken = previousCount
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})
	const body = `{"model":"claude-count-fixture","messages":[{"role":"user","content":"hello"}],"tools":[{"name":"lookup","input_schema":{"type":"object"}}]}`
	const response = `{"input_tokens":741}`
	captured := make(chan string, 1)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, readErr := io.ReadAll(r.Body)
		assert.NoError(t, readErr)
		assert.Equal(t, "/v1/messages/count_tokens", r.URL.Path)
		captured <- string(data)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, response)
	}))
	t.Cleanup(upstream.Close)
	service.InitHttpClient()
	user := model.User{Username: "count-user", Status: common.UserStatusEnabled, Group: "default", Quota: 100000}
	require.NoError(t, db.Create(&user).Error)
	token := model.Token{UserId: user.Id, Key: "countfixturekey", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: 100000, Group: "default"}
	require.NoError(t, db.Create(&token).Error)
	channel := model.Channel{Type: constant.ChannelTypeAnthropic, Name: "count-channel", Key: "fixture-upstream-key", Status: common.ChannelStatusEnabled, BaseURL: &upstream.URL, Models: "claude-count-fixture", Group: "default"}
	require.NoError(t, channel.Insert())
	engine := gin.New()
	SetRelayRouter(engine)
	request := httptest.NewRequest(http.MethodPost, "/v1/messages/count_tokens", strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer countfixturekey")
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	assert.JSONEq(t, response, recorder.Body.String())
	select {
	case got := <-captured:
		assert.Equal(t, body, got)
	default:
		t.Fatal("request did not reach upstream")
	}
	require.NoError(t, db.First(&user, user.Id).Error)
	require.NoError(t, db.First(&token, token.Id).Error)
	assert.Equal(t, 100000, user.Quota)
	assert.Zero(t, user.UsedQuota)
	assert.Equal(t, 100000, token.RemainQuota)
	assert.Zero(t, token.UsedQuota)
}
