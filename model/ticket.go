package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	TicketStatusProcessing = "processing" // 处理中
	TicketStatusWaiting    = "waiting"    // 等待用户回复
	TicketStatusResolved   = "resolved"   // 已完成
	TicketStatusClosed     = "closed"     // 已关闭

	MaxTicketTitleLength   = 200
	MaxTicketContentLength = 4000
)

var validTicketStatuses = map[string]struct{}{
	TicketStatusProcessing: {},
	TicketStatusWaiting:    {},
	TicketStatusResolved:   {},
	TicketStatusClosed:     {},
}

func IsValidTicketStatus(status string) bool {
	_, ok := validTicketStatuses[status]
	return ok
}

// Ticket is a user-submitted support ticket. Time fields use Unix seconds so
// the table stays portable across SQLite, MySQL, and PostgreSQL.
type Ticket struct {
	Id            int    `json:"id" gorm:"primaryKey"`
	UserId        int    `json:"user_id" gorm:"index;not null"`
	Username      string `json:"username" gorm:"type:varchar(64);not null"`
	Title         string `json:"title" gorm:"type:varchar(255);not null"`
	Status        string `json:"status" gorm:"type:varchar(16);not null;index"`
	CreatedTime   int64  `json:"created_time" gorm:"not null"`
	UpdatedTime   int64  `json:"updated_time" gorm:"not null"`
	UserReadTime  int64  `json:"user_read_time" gorm:"not null;default:0"`
	AdminReadTime int64  `json:"admin_read_time" gorm:"not null;default:0"`
	Unread        bool   `json:"unread" gorm:"-"`
}

func (Ticket) TableName() string {
	return "tickets"
}

// TicketReply is one message inside a ticket conversation. The initial ticket
// content is stored as the first reply (IsAdmin = false).
type TicketReply struct {
	Id          int    `json:"id" gorm:"primaryKey"`
	TicketId    int    `json:"ticket_id" gorm:"index;not null"`
	UserId      int    `json:"user_id" gorm:"not null"`
	Username    string `json:"username" gorm:"type:varchar(64);not null"`
	IsAdmin     bool   `json:"is_admin" gorm:"not null"`
	Content     string `json:"content" gorm:"type:text;not null"`
	CreatedTime int64  `json:"created_time" gorm:"not null"`
}

func (TicketReply) TableName() string {
	return "ticket_replies"
}

func CreateTicket(ticket *Ticket, firstReply *TicketReply) error {
	if ticket == nil {
		return errors.New("ticket is nil")
	}
	if firstReply == nil {
		return errors.New("ticket content is required")
	}
	now := common.GetTimestamp()
	ticket.Status = TicketStatusProcessing
	ticket.CreatedTime = now
	ticket.UpdatedTime = now
	firstReply.CreatedTime = now
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		firstReply.TicketId = ticket.Id
		return tx.Create(firstReply).Error
	})
}

func GetTicketById(id int) (*Ticket, error) {
	if id <= 0 {
		return nil, errors.New("无效的工单 ID")
	}
	ticket := &Ticket{}
	if err := DB.First(ticket, id).Error; err != nil {
		return nil, err
	}
	return ticket, nil
}

func GetRepliesByTicketId(ticketId int) ([]*TicketReply, error) {
	replies := make([]*TicketReply, 0)
	err := DB.Where("ticket_id = ?", ticketId).Order("id ASC").Find(&replies).Error
	return replies, err
}

// markTicketUnread computes the unread flag for a ticket relative to the
// viewer. A waiting ticket (last action was an admin reply) newer than the
// viewer's read time counts as unread.
func markTicketUnread(ticket *Ticket, adminView bool) {
	readTime := ticket.UserReadTime
	if adminView {
		readTime = ticket.AdminReadTime
	}
	ticket.Unread = ticket.Status == TicketStatusWaiting && ticket.UpdatedTime > readTime
}

func GetUserTickets(userId int, page int, pageSize int, status string, keyword string, unreadOnly bool) ([]*Ticket, int64, error) {
	tickets := make([]*Ticket, 0)
	query := DB.Model(&Ticket{}).Where("user_id = ?", userId)
	if status != "" {
		if !IsValidTicketStatus(status) {
			return nil, 0, errors.New("无效的工单状态")
		}
		query = query.Where("status = ?", status)
	}
	if keyword != "" {
		query = query.Where("title LIKE ?", "%"+keyword+"%")
	}
	if unreadOnly {
		query = query.Where("status = ? AND updated_time > user_read_time", TicketStatusWaiting)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("updated_time DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&tickets).Error
	if err != nil {
		return nil, 0, err
	}
	for _, t := range tickets {
		markTicketUnread(t, false)
	}
	return tickets, total, nil
}

// CountUserTicketsByStatus returns the number of tickets per status for one user.
func CountUserTicketsByStatus(userId int) (map[string]int64, error) {
	type statusCount struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	counts := make([]statusCount, 0, 4)
	err := DB.Model(&Ticket{}).
		Select("status, COUNT(*) as count").
		Where("user_id = ?", userId).
		Group("status").
		Scan(&counts).Error
	if err != nil {
		return nil, err
	}
	result := map[string]int64{
		TicketStatusProcessing: 0,
		TicketStatusWaiting:    0,
		TicketStatusResolved:   0,
		TicketStatusClosed:     0,
	}
	for _, c := range counts {
		result[c.Status] = c.Count
	}
	return result, nil
}

func GetAllTickets(page int, pageSize int, status string, username string, keyword string) ([]*Ticket, int64, error) {
	tickets := make([]*Ticket, 0)
	query := DB.Model(&Ticket{})
	if status != "" {
		if !IsValidTicketStatus(status) {
			return nil, 0, errors.New("无效的工单状态")
		}
		query = query.Where("status = ?", status)
	}
	if username != "" {
		query = query.Where("username LIKE ?", "%"+username+"%")
	}
	if keyword != "" {
		query = query.Where("title LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("updated_time DESC").Limit(pageSize).Offset((page - 1) * pageSize).Find(&tickets).Error
	if err != nil {
		return nil, 0, err
	}
	for _, t := range tickets {
		markTicketUnread(t, true)
	}
	return tickets, total, nil
}

// MarkTicketRead records the viewer's read time so the ticket stops counting
// as unread for them.
func MarkTicketRead(ticketId int, adminView bool) error {
	now := common.GetTimestamp()
	column := "user_read_time"
	if adminView {
		column = "admin_read_time"
	}
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).Update(column, now).Error
}

func CreateTicketReply(reply *TicketReply) (*Ticket, error) {
	if reply == nil {
		return nil, errors.New("reply is nil")
	}
	ticket, err := GetTicketById(reply.TicketId)
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	reply.CreatedTime = now
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(reply).Error; err != nil {
			return err
		}
		return tx.Model(&Ticket{}).Where("id = ?", ticket.Id).Update("updated_time", now).Error
	})
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

func UpdateTicketStatus(id int, status string) (*Ticket, error) {
	if !IsValidTicketStatus(status) {
		return nil, errors.New("无效的工单状态")
	}
	ticket, err := GetTicketById(id)
	if err != nil {
		return nil, err
	}
	err = DB.Model(&Ticket{}).Where("id = ?", id).Updates(map[string]any{
		"status":       status,
		"updated_time": common.GetTimestamp(),
	}).Error
	if err != nil {
		return nil, err
	}
	ticket.Status = status
	return ticket, nil
}

func DeleteTicket(id int) error {
	result := DB.Delete(&Ticket{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return DB.Where("ticket_id = ?", id).Delete(&TicketReply{}).Error
}
