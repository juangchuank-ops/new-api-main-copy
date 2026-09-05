package model

import (
	"errors"
	"fmt"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const ipBanSnapshotTTL = 5 * time.Second

type IPBan struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	Rule           string `json:"rule" gorm:"type:varchar(64);not null;uniqueIndex"`
	Reason         string `json:"reason" gorm:"type:text;not null"`
	Enabled        bool   `json:"enabled" gorm:"not null;index"`
	ExpiresAt      int64  `json:"expires_at" gorm:"not null;index"`
	TargetUserId   int    `json:"target_user_id" gorm:"not null;default:0;index"`
	TargetUsername string `json:"target_username" gorm:"type:varchar(64);not null;default:''"`
	CreatedAt      int64  `json:"created_at" gorm:"not null"`
	UpdatedAt      int64  `json:"updated_at" gorm:"not null"`
	OperatorId     int    `json:"operator_id" gorm:"not null;index"`
}

func (IPBan) TableName() string {
	return "ip_bans"
}

type ipBanMatcher struct {
	address *netip.Addr
	prefix  *netip.Prefix
	ban     IPBan
}

var ipBanSnapshot = struct {
	sync.RWMutex
	loadedAt time.Time
	matchers []ipBanMatcher
}{}

func CanonicalizeIPBanRule(rule string) (string, error) {
	rule = strings.TrimSpace(rule)
	if rule == "" {
		return "", errors.New("IP ban rule is required")
	}
	if strings.Contains(rule, "/") {
		prefix, err := netip.ParsePrefix(rule)
		if err != nil {
			return "", fmt.Errorf("invalid IP CIDR: %w", err)
		}
		if prefix.Addr().Zone() != "" {
			return "", errors.New("IP address zones are not supported")
		}
		return prefix.Masked().String(), nil
	}
	address, err := netip.ParseAddr(rule)
	if err != nil {
		return "", fmt.Errorf("invalid IP address: %w", err)
	}
	if address.Zone() != "" {
		return "", errors.New("IP address zones are not supported")
	}
	return address.String(), nil
}

type IPBanUserLoginIP struct {
	IP         string `json:"ip"`
	LastSeenAt int64  `json:"last_seen_at"`
}

type IPBanUserIP struct {
	Id          int                `json:"id"`
	Username    string             `json:"username"`
	DisplayName string             `json:"display_name"`
	Email       string             `json:"email"`
	IPs         []IPBanUserLoginIP `json:"ips"`
}

func ListIPBanUsers(keyword string, offset, limit int) ([]IPBanUserIP, int64, error) {
	keyword = strings.TrimSpace(keyword)
	query := DB.Model(&User{})
	pattern := "%" + keyword + "%"
	condition := "username LIKE ? OR email LIKE ? OR display_name LIKE ?"
	args := []any{pattern, pattern, pattern}
	if id, err := strconv.Atoi(keyword); err == nil {
		condition = "id = ? OR " + condition
		args = append([]any{id}, args...)
	}
	query = query.Where("("+condition+")", args...)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []*User
	if err := query.Omit("password").Order("id DESC").Offset(offset).Limit(limit).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	if LOG_DB == nil {
		return nil, 0, errors.New("login database is unavailable")
	}
	result := make([]IPBanUserIP, 0, len(users))
	for _, user := range users {
		var logs []Log
		if err := LOG_DB.Where("user_id = ? AND type = ? AND ip <> ?", user.Id, LogTypeLogin, "").Order("created_at DESC, id DESC").Limit(200).Find(&logs).Error; err != nil {
			return nil, 0, err
		}
		seen := make(map[string]struct{}, len(logs))
		ips := make([]IPBanUserLoginIP, 0, len(logs))
		for _, log := range logs {
			ip := strings.TrimSpace(log.Ip)
			canonical, parseErr := CanonicalizeIPBanRule(ip)
			if parseErr != nil || strings.Contains(canonical, "/") {
				continue
			}
			address, parseErr := netip.ParseAddr(canonical)
			if parseErr != nil || address.IsLoopback() || address.IsUnspecified() {
				continue
			}
			if _, ok := seen[canonical]; ok {
				continue
			}
			seen[canonical] = struct{}{}
			ips = append(ips, IPBanUserLoginIP{IP: canonical, LastSeenAt: log.CreatedAt})
		}
		result = append(result, IPBanUserIP{
			Id:          user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
			IPs:         ips,
		})
	}
	return result, total, nil
}

func ListIPBans(offset, limit int, search string) ([]IPBan, int64, error) {
	query := DB.Model(&IPBan{})
	if search = strings.TrimSpace(search); search != "" {
		pattern := "%" + search + "%"
		query = query.Where("rule LIKE ? OR reason LIKE ? OR target_username LIKE ?", pattern, pattern, pattern)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	bans := make([]IPBan, 0)
	if err := query.Order("id DESC").Offset(offset).Limit(limit).Find(&bans).Error; err != nil {
		return nil, 0, err
	}
	return bans, total, nil
}

func GetIPBanByID(id int) (*IPBan, error) {
	ban := &IPBan{}
	if err := DB.First(ban, id).Error; err != nil {
		return nil, err
	}
	return ban, nil
}

func validateIPBanTarget(rule string, targetUserID int) (string, error) {
	canonical, err := CanonicalizeIPBanRule(rule)
	if err != nil {
		return "", err
	}
	if targetUserID <= 0 {
		return canonical, nil
	}
	if strings.Contains(canonical, "/") {
		return "", errors.New("CIDR rules cannot target a user")
	}
	user, err := GetUserById(targetUserID, false)
	if err != nil {
		return "", errors.New("target user not found")
	}
	if LOG_DB == nil {
		return "", errors.New("login database is unavailable")
	}
	var logs []Log
	err = LOG_DB.Where("user_id = ? AND type = ? AND ip <> ?", user.Id, LogTypeLogin, "").Order("created_at DESC, id DESC").Limit(200).Find(&logs).Error
	if err != nil {
		return "", err
	}
	for _, log := range logs {
		loginIP, parseErr := CanonicalizeIPBanRule(log.Ip)
		if parseErr == nil && !strings.Contains(loginIP, "/") && loginIP == canonical {
			return canonical, nil
		}
	}
	return "", errors.New("rule is not a successful login IP for target user")
}

func CreateIPBan(ban *IPBan) error {
	if ban == nil {
		return errors.New("IP ban is nil")
	}
	canonical, err := validateIPBanTarget(ban.Rule, ban.TargetUserId)
	if err != nil {
		return err
	}
	ban.Rule = canonical
	ban.Reason = strings.TrimSpace(ban.Reason)
	if ban.TargetUserId <= 0 {
		ban.TargetUserId = 0
		ban.TargetUsername = ""
	} else {
		user, _ := GetUserById(ban.TargetUserId, false)
		ban.TargetUsername = user.Username
	}
	now := common.GetTimestamp()
	ban.CreatedAt = now
	ban.UpdatedAt = now
	if err := DB.Create(ban).Error; err != nil {
		return err
	}
	InvalidateIPBanSnapshot()
	return nil
}

func UpdateIPBan(id int, rule, reason string, enabled bool, expiresAt int64, targetUserID, operatorId int) (*IPBan, error) {
	canonical, err := validateIPBanTarget(rule, targetUserID)
	if err != nil {
		return nil, err
	}
	if targetUserID < 0 {
		targetUserID = 0
	}
	targetUsername := ""
	if targetUserID > 0 {
		user, err := GetUserById(targetUserID, false)
		if err != nil {
			return nil, errors.New("target user not found")
		}
		targetUsername = user.Username
	}
	updates := map[string]any{
		"rule":            canonical,
		"reason":          strings.TrimSpace(reason),
		"enabled":         enabled,
		"expires_at":      expiresAt,
		"target_user_id":  targetUserID,
		"target_username": targetUsername,
		"updated_at":      common.GetTimestamp(),
		"operator_id":     operatorId,
	}
	result := DB.Model(&IPBan{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	InvalidateIPBanSnapshot()
	return GetIPBanByID(id)
}

func DeleteIPBan(id int) error {
	result := DB.Delete(&IPBan{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	InvalidateIPBanSnapshot()
	return nil
}

func ToggleIPBan(id, operatorId int) (*IPBan, error) {
	var updated *IPBan
	err := DB.Transaction(func(tx *gorm.DB) error {
		ban := &IPBan{}
		if err := tx.First(ban, id).Error; err != nil {
			return err
		}
		ban.Enabled = !ban.Enabled
		ban.OperatorId = operatorId
		ban.UpdatedAt = common.GetTimestamp()
		if err := tx.Model(ban).Select("enabled", "operator_id", "updated_at").Updates(ban).Error; err != nil {
			return err
		}
		updated = ban
		return nil
	})
	if err != nil {
		return nil, err
	}
	InvalidateIPBanSnapshot()
	return updated, nil
}

func InvalidateIPBanSnapshot() {
	ipBanSnapshot.Lock()
	ipBanSnapshot.loadedAt = time.Time{}
	ipBanSnapshot.matchers = nil
	ipBanSnapshot.Unlock()
}

// MatchIPBan returns the active ban matching ip, including display metadata.
func MatchIPBan(ip string, now time.Time) (*IPBan, error) {
	address, err := netip.ParseAddr(strings.TrimSpace(ip))
	if err != nil {
		return nil, err
	}
	ipBanSnapshot.RLock()
	if !ipBanSnapshot.loadedAt.IsZero() && now.Sub(ipBanSnapshot.loadedAt) < ipBanSnapshotTTL {
		ban := matchedIPBan(address, ipBanSnapshot.matchers)
		ipBanSnapshot.RUnlock()
		return ban, nil
	}
	ipBanSnapshot.RUnlock()

	ipBanSnapshot.Lock()
	defer ipBanSnapshot.Unlock()
	if !ipBanSnapshot.loadedAt.IsZero() && now.Sub(ipBanSnapshot.loadedAt) < ipBanSnapshotTTL {
		return matchedIPBan(address, ipBanSnapshot.matchers), nil
	}
	var bans []IPBan
	if err := DB.Where("enabled = ? AND (expires_at = ? OR expires_at > ?)", true, 0, now.Unix()).Order("id DESC").Find(&bans).Error; err != nil {
		return nil, err
	}
	matchers := make([]ipBanMatcher, 0, len(bans))
	for _, ban := range bans {
		if strings.Contains(ban.Rule, "/") {
			prefix, parseErr := netip.ParsePrefix(ban.Rule)
			if parseErr != nil {
				common.SysError(fmt.Sprintf("invalid stored IP ban rule %q: %v", ban.Rule, parseErr))
				continue
			}
			prefix = prefix.Masked()
			matchers = append(matchers, ipBanMatcher{prefix: &prefix, ban: ban})
			continue
		}
		storedAddress, parseErr := netip.ParseAddr(ban.Rule)
		if parseErr != nil {
			common.SysError(fmt.Sprintf("invalid stored IP ban rule %q: %v", ban.Rule, parseErr))
			continue
		}
		matchers = append(matchers, ipBanMatcher{address: &storedAddress, ban: ban})
	}
	ipBanSnapshot.matchers = matchers
	ipBanSnapshot.loadedAt = now
	return matchedIPBan(address, matchers), nil
}

func IsIPBanned(ip string, now time.Time) (bool, error) {
	ban, err := MatchIPBan(ip, now)
	return ban != nil, err
}

func matchedIPBan(address netip.Addr, matchers []ipBanMatcher) *IPBan {
	for _, matcher := range matchers {
		if (matcher.address != nil && *matcher.address == address) ||
			(matcher.prefix != nil && matcher.prefix.Contains(address)) {
			ban := matcher.ban
			return &ban
		}
	}
	return nil
}

// BanUserLoginIPs bans every distinct successful-login IP of the user so a
// banned account cannot re-enter from its known addresses. Rules that already
// exist are skipped. It returns the newly created rules.
func BanUserLoginIPs(userId int, reason string, expiresAt int64, operatorId int) ([]string, error) {
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, errors.New("target user not found")
	}
	if LOG_DB == nil {
		return nil, errors.New("login database is unavailable")
	}
	var logs []Log
	if err := LOG_DB.Where("user_id = ? AND type = ? AND ip <> ?", user.Id, LogTypeLogin, "").Order("created_at DESC, id DESC").Limit(200).Find(&logs).Error; err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	ips := make([]string, 0)
	for _, log := range logs {
		canonical, parseErr := CanonicalizeIPBanRule(log.Ip)
		if parseErr != nil || strings.Contains(canonical, "/") {
			continue
		}
		address, parseErr := netip.ParseAddr(canonical)
		if parseErr != nil || address.IsLoopback() || address.IsUnspecified() {
			continue
		}
		if _, ok := seen[canonical]; ok {
			continue
		}
		seen[canonical] = struct{}{}
		ips = append(ips, canonical)
	}
	if len(ips) == 0 {
		return nil, nil
	}
	var existing []string
	if err := DB.Model(&IPBan{}).Where("rule IN ?", ips).Pluck("rule", &existing).Error; err != nil {
		return nil, err
	}
	existingSet := make(map[string]struct{}, len(existing))
	for _, rule := range existing {
		existingSet[rule] = struct{}{}
	}
	now := common.GetTimestamp()
	reason = strings.TrimSpace(reason)
	banned := make([]string, 0)
	for _, ip := range ips {
		if _, ok := existingSet[ip]; ok {
			continue
		}
		ban := &IPBan{
			Rule:           ip,
			Reason:         reason,
			Enabled:        true,
			ExpiresAt:      expiresAt,
			TargetUserId:   user.Id,
			TargetUsername: user.Username,
			CreatedAt:      now,
			UpdatedAt:      now,
			OperatorId:     operatorId,
		}
		if err := DB.Create(ban).Error; err != nil {
			continue
		}
		banned = append(banned, ip)
	}
	if len(banned) > 0 {
		InvalidateIPBanSnapshot()
	}
	return banned, nil
}
