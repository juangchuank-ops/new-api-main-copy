package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type createTicketRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type ticketReplyRequest struct {
	Content string `json:"content"`
}

type ticketStatusRequest struct {
	Status string `json:"status"`
}

func validateTicketContent(title string, content string) error {
	title = strings.TrimSpace(title)
	content = strings.TrimSpace(content)
	if utf8.RuneCountInString(title) == 0 {
		return errors.New("工单标题不能为空")
	}
	if utf8.RuneCountInString(title) > model.MaxTicketTitleLength {
		return errors.New("工单标题过长")
	}
	if utf8.RuneCountInString(content) == 0 {
		return errors.New("工单内容不能为空")
	}
	if utf8.RuneCountInString(content) > model.MaxTicketContentLength {
		return errors.New("工单内容过长")
	}
	return nil
}

// GetMyTickets lists the current user's tickets with per-status statistics.
func GetMyTickets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	status := c.Query("status")
	keyword := c.Query("keyword")
	unreadOnly := c.Query("unread") == "true"
	tickets, total, err := model.GetUserTickets(userId, pageInfo.GetPage(), pageInfo.GetPageSize(), status, keyword, unreadOnly)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	stats, err := model.CountUserTicketsByStatus(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": tickets,
			"total": total,
			"stats": stats,
		},
	})
}

// CreateUserTicket creates a ticket; the initial content becomes the first reply.
func CreateUserTicket(c *gin.Context) {
	var request createTicketRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTicketContent(request.Title, request.Content); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	username := c.GetString("username")
	ticket := &model.Ticket{
		UserId:   userId,
		Username: username,
		Title:    strings.TrimSpace(request.Title),
	}
	firstReply := &model.TicketReply{
		UserId:   userId,
		Username: username,
		IsAdmin:  false,
		Content:  strings.TrimSpace(request.Content),
	}
	if err := model.CreateTicket(ticket, firstReply); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

func canAccessTicket(c *gin.Context, ticket *model.Ticket) bool {
	if ticket.UserId == c.GetInt("id") {
		return true
	}
	return c.GetInt("role") >= common.RoleAdminUser
}

// GetUserTicketDetail returns a ticket together with its replies.
func GetUserTicketDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的工单 ID")
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canAccessTicket(c, ticket) {
		common.ApiErrorMsg(c, "无权查看该工单")
		return
	}
	// 打开详情即视为已读
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	if ticket.UserId == c.GetInt("id") {
		_ = model.MarkTicketRead(id, false)
	}
	if isAdmin {
		_ = model.MarkTicketRead(id, true)
	}
	replies, err := model.GetRepliesByTicketId(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"ticket":  ticket,
		"replies": replies,
	})
}

// ReplyOwnTicket lets the ticket owner append a reply.
func ReplyOwnTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的工单 ID")
		return
	}
	ticket, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if ticket.UserId != c.GetInt("id") {
		common.ApiErrorMsg(c, "无权回复该工单")
		return
	}
	if ticket.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭，无法回复")
		return
	}
	var request ticketReplyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	content := strings.TrimSpace(request.Content)
	if len(content) == 0 {
		common.ApiErrorMsg(c, "回复内容不能为空")
		return
	}
	if utf8.RuneCountInString(content) > model.MaxTicketContentLength {
		common.ApiErrorMsg(c, "回复内容过长")
		return
	}
	reply := &model.TicketReply{
		TicketId: id,
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		IsAdmin:  false,
		Content:  content,
	}
	ticket, err = model.CreateTicketReply(reply)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	// 用户回复后回到"处理中"，提醒平台侧跟进
	if ticket.Status == model.TicketStatusWaiting {
		ticket, err = model.UpdateTicketStatus(id, model.TicketStatusProcessing)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	common.ApiSuccess(c, ticket)
}

// GetAllTicketsForAdmin lists all tickets with optional status/username filter.
func GetAllTicketsForAdmin(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	status := c.Query("status")
	username := c.Query("username")
	keyword := c.Query("keyword")
	tickets, total, err := model.GetAllTickets(pageInfo.GetPage(), pageInfo.GetPageSize(), status, username, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(tickets)
	common.ApiSuccess(c, pageInfo)
}

// AdminReplyTicket lets an admin reply to any ticket (status becomes waiting).
func AdminReplyTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的工单 ID")
		return
	}
	// 已关闭的工单为终态，禁止任何回复
	existing, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if existing.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭，无法回复")
		return
	}
	var request ticketReplyRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	content := strings.TrimSpace(request.Content)
	if len(content) == 0 {
		common.ApiErrorMsg(c, "回复内容不能为空")
		return
	}
	if utf8.RuneCountInString(content) > model.MaxTicketContentLength {
		common.ApiErrorMsg(c, "回复内容过长")
		return
	}
	reply := &model.TicketReply{
		TicketId: id,
		UserId:   c.GetInt("id"),
		Username: c.GetString("username"),
		IsAdmin:  true,
		Content:  content,
	}
	if _, err := model.CreateTicketReply(reply); err != nil {
		common.ApiError(c, err)
		return
	}
	ticket, err := model.UpdateTicketStatus(id, model.TicketStatusWaiting)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

// AdminUpdateTicketStatus completes / closes / reopens a ticket.
func AdminUpdateTicketStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的工单 ID")
		return
	}
	var request ticketStatusRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if request.Status == model.TicketStatusWaiting {
		common.ApiErrorMsg(c, "无效的工单状态")
		return
	}
	// 已关闭的工单为终态，状态永远保持关闭
	current, err := model.GetTicketById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if current.Status == model.TicketStatusClosed {
		common.ApiErrorMsg(c, "工单已关闭，无法再变更状态")
		return
	}
	ticket, err := model.UpdateTicketStatus(id, request.Status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, ticket)
}

// AdminDeleteTicket removes a ticket and its replies.
func AdminDeleteTicket(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "无效的工单 ID")
		return
	}
	if err := model.DeleteTicket(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
