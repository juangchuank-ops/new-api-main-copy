package controller

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type wechatLoginResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    string `json:"data"`
}

func getWeChatIdByCode(code string) (string, error) {
	if code == "" {
		return "", errors.New("invalid parameters")
	}
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/api/wechat/user?code=%s", common.WeChatServerAddress, url.QueryEscape(code)), nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", common.WeChatServerToken)
	client := http.Client{
		Timeout: 5 * time.Second,
	}
	httpResponse, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer httpResponse.Body.Close()
	var res wechatLoginResponse
	err = json.NewDecoder(httpResponse.Body).Decode(&res)
	if err != nil {
		return "", err
	}
	if !res.Success {
		return "", errors.New(res.Message)
	}
	if res.Data == "" {
		return "", errors.New("verification code error or expired")
	}
	return res.Data, nil
}

func WeChatAuth(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgWeChatNotEnabled)
		return
	}
	code := c.Query("code")
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	user := model.User{
		WeChatId: wechatId,
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		err := user.FillUserByWeChatId()
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		if user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgOAuthUserDeleted)
			return
		}
	} else {
		if common.RegisterEnabled {
			invitationCode := ""
			if common.InvitationCodeEnabled {
				session := sessions.Default(c)
				invitationCode, _ = session.Get("invitation_code").(string)
				if invitationCode == "" {
					common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeRequired)
					return
				}
				_, err := model.ValidateInvitationCode(invitationCode)
				if err != nil {
					common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
					return
				}
			}

			user.Username = "wechat_" + strconv.Itoa(model.GetMaxUserId()+1)
			user.DisplayName = "WeChat User"
			user.Role = model.ResolveNewUserRole()
			user.Status = common.UserStatusEnabled

			err := model.DB.Transaction(func(tx *gorm.DB) error {
				if err := user.InsertWithTx(tx, 0); err != nil {
					return err
				}
				if common.InvitationCodeEnabled {
					return model.UseInvitationCodeWithTx(tx, invitationCode, user.Id)
				}
				return nil
			})
			if err != nil {
				if errors.Is(err, model.ErrInvitationCodeUnavailable) {
					common.ApiErrorI18n(c, i18n.MsgOAuthInvitationCodeInvalid)
					return
				}
				c.JSON(http.StatusOK, gin.H{
					"success": false,
					"message": err.Error(),
				})
				return
			}
			user.FinalizeUserCreation(0)

			if common.InvitationCodeEnabled {
				session := sessions.Default(c)
				session.Delete("invitation_code")
				if err := session.Save(); err != nil {
					common.SysError(fmt.Sprintf("[WeChat] Failed to clear invitation code session: %s", err.Error()))
				}
			}
		} else {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			return
		}
	}

	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgOAuthUserBanned)
		return
	}
	setupLogin(&user, c)
}

type wechatBindRequest struct {
	Code string `json:"code"`
}

func WeChatBind(c *gin.Context) {
	if !common.WeChatAuthEnabled {
		common.ApiErrorI18n(c, i18n.MsgWeChatNotEnabled)
		return
	}
	var req wechatBindRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "invalid request",
		})
		return
	}
	code := req.Code
	wechatId, err := getWeChatIdByCode(code)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"message": err.Error(),
			"success": false,
		})
		return
	}
	if model.IsWeChatIdAlreadyTaken(wechatId) {
		common.ApiErrorI18n(c, i18n.MsgWeChatAlreadyBound)
		return
	}
	session := sessions.Default(c)
	id := session.Get("id")
	user := model.User{
		Id: id.(int),
	}
	err = user.FillUserById()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	user.WeChatId = wechatId
	err = user.Update(false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
