package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// SendEmailRequest 发送邮件请求
type SendEmailRequest struct {
	Subject string `json:"subject" binding:"required"`
	Content string `json:"content" binding:"required"`
}

// SendEmailToSelf 发送邮件到当前用户的邮箱
func SendEmailToSelf(c *gin.Context) {
	userId := c.GetInt("id")
	
	var req SendEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "参数错误: " + err.Error(),
		})
		return
	}
	
	// 获取用户信息
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取用户信息失败",
		})
		return
	}
	
	if user.Email == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "用户未设置邮箱",
		})
		return
	}
	
	// 发送邮件
	err = common.SendEmail(req.Subject, user.Email, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "邮件发送失败: " + err.Error(),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "邮件发送成功",
		"data": gin.H{
			"email": user.Email,
		},
	})
}
