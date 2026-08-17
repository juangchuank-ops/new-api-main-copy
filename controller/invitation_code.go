package controller

import (
	"errors"
	"net/http"
	"strconv"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func GetAllInvitationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	invitationCodes, total, err := model.GetAllInvitationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invitationCodes)
	common.ApiSuccess(c, pageInfo)
	return
}

func SearchInvitationCodes(c *gin.Context) {
	keyword := c.Query("keyword")
	pageInfo := common.GetPageQuery(c)
	invitationCodes, total, err := model.SearchInvitationCodes(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invitationCodes)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	invitationCode, err := model.GetInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    invitationCode,
	})
	return
}

func AddInvitationCode(c *gin.Context) {
	invitationCode := model.InvitationCode{}
	err := c.ShouldBindJSON(&invitationCode)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if utf8.RuneCountInString(invitationCode.Name) == 0 || utf8.RuneCountInString(invitationCode.Name) > 20 {
		common.ApiErrorI18n(c, i18n.MsgInvitationCodeNameLength)
		return
	}
	if invitationCode.Count <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvitationCodeCountPositive)
		return
	}
	if invitationCode.Count > 1000 {
		common.ApiErrorI18n(c, i18n.MsgInvitationCodeCountMax)
		return
	}
	var keys []string
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < invitationCode.Count; i++ {
			key := common.GetUUID()
			cleanInvitationCode := model.InvitationCode{
				UserId:      c.GetInt("id"),
				Name:        invitationCode.Name,
				Key:         key,
				CreatedTime: common.GetTimestamp(),
			}
			if err := tx.Create(&cleanInvitationCode).Error; err != nil {
				return err
			}
			keys = append(keys, key)
		}
		return nil
	})
	if err != nil {
		common.SysError("failed to insert invitation code: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": i18n.T(c, i18n.MsgInvitationCodeCreateFailed),
			"data":    nil,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    keys,
	})
	return
}

func UpdateInvitationCode(c *gin.Context) {
	statusOnly := c.Query("status_only")
	invitationCode := model.InvitationCode{}
	err := c.ShouldBindJSON(&invitationCode)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	cleanInvitationCode, err := model.GetInvitationCodeById(invitationCode.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly == "" {
		cleanInvitationCode.Name = invitationCode.Name
	}
	if statusOnly != "" {
		cleanInvitationCode.Status = invitationCode.Status
	}
	err = cleanInvitationCode.Update()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cleanInvitationCode,
	})
	return
}

func DeleteInvitationCode(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	err := model.DeleteInvitationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func DeleteInvalidInvitationCode(c *gin.Context) {
	rows, err := model.DeleteInvalidInvitationCodes()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
	return
}

func GetUserInvitationCodes(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	invitationCodes, total, err := model.GetUserInvitationCodes(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invitationCodes)
	common.ApiSuccess(c, pageInfo)
}

func GetUserAvailableInvitationCodeKeys(c *gin.Context) {
	keys, err := model.GetUserAvailableInvitationCodeKeys(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, keys)
}

func DeleteUserInvitationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	rows, err := model.DeleteUserInvitationCodes(c.GetInt("id"), []int{id})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

func DeleteUserInvitationCodeBatch(c *gin.Context) {
	request := struct {
		Ids []int `json:"ids"`
	}{}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(request.Ids) == 0 || len(request.Ids) > 100 {
		common.ApiError(c, errors.New("between 1 and 100 invitation code ids are required"))
		return
	}
	for _, id := range request.Ids {
		if id <= 0 {
			common.ApiError(c, errors.New("invalid invitation code id"))
			return
		}
	}

	rows, err := model.DeleteUserInvitationCodes(c.GetInt("id"), request.Ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

func DeleteUserUsedInvitationCodes(c *gin.Context) {
	rows, err := model.DeleteUserUsedInvitationCodes(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rows)
}

func CheckInvitationCode(c *gin.Context) {
	key := c.Query("key")
	_, err := model.ValidateInvitationCode(key)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvitationCodeInvalid)
		return
	}
	common.ApiSuccess(c, gin.H{"valid": true})
	return
}
