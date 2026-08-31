package model

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const browserFingerprintBanSnapshotTTL = 5 * time.Second

var browserFingerprintHashPattern = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)

type BrowserFingerprintBan struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	FingerprintHash string `json:"fingerprint_hash" gorm:"type:char(64);not null;uniqueIndex"`
	Reason          string `json:"reason" gorm:"type:text;not null"`
	Enabled         bool   `json:"enabled" gorm:"not null;index"`
	ExpiresAt       int64  `json:"expires_at" gorm:"not null;index"`
	TargetUserId    int    `json:"target_user_id" gorm:"not null;default:0;index"`
	TargetUsername  string `json:"target_username" gorm:"type:varchar(64);not null;default:''"`
	CreatedAt       int64  `json:"created_at" gorm:"not null"`
	UpdatedAt       int64  `json:"updated_at" gorm:"not null"`
	OperatorId      int    `json:"operator_id" gorm:"not null;index"`
}

type BrowserFingerprintUser struct {
	Id           int                       `json:"id"`
	Username     string                    `json:"username"`
	DisplayName  string                    `json:"display_name"`
	Email        string                    `json:"email"`
	Fingerprints []BrowserFingerprintLogin `json:"fingerprints"`
}

type BrowserFingerprintLogin struct {
	FingerprintHash string `json:"fingerprint_hash"`
	LastSeenAt      int64  `json:"last_seen_at"`
}

func (BrowserFingerprintBan) TableName() string {
	return "browser_fingerprint_bans"
}

var browserFingerprintSnapshot = struct {
	sync.RWMutex
	loadedAt time.Time
	bans     []BrowserFingerprintBan
}{}

func NormalizeBrowserFingerprintHash(value string) (string, error) {
	value = strings.TrimSpace(value)
	if !browserFingerprintHashPattern.MatchString(value) {
		return "", errors.New("browser fingerprint must be a SHA-256 hash")
	}
	return strings.ToLower(value), nil
}

func HashBrowserFingerprint(value string) (string, error) {
	return NormalizeBrowserFingerprintHash(value)
}

func ListBrowserFingerprintBans(offset, limit int, search string) ([]BrowserFingerprintBan, int64, error) {
	query := DB.Model(&BrowserFingerprintBan{})
	if search = strings.TrimSpace(search); search != "" {
		pattern := "%" + search + "%"
		query = query.Where("fingerprint_hash LIKE ? OR reason LIKE ? OR target_username LIKE ?", pattern, pattern, pattern)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	bans := make([]BrowserFingerprintBan, 0)
	if err := query.Order("id DESC").Offset(offset).Limit(limit).Find(&bans).Error; err != nil {
		return nil, 0, err
	}
	return bans, total, nil
}

func ListBrowserFingerprintUsers(keyword string, offset, limit int) ([]BrowserFingerprintUser, int64, error) {
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
	result := make([]BrowserFingerprintUser, 0, len(users))
	for _, user := range users {
		var logs []Log
		if err := LOG_DB.Where("user_id = ? AND type = ?", user.Id, LogTypeLogin).Order("created_at DESC, id DESC").Limit(200).Find(&logs).Error; err != nil {
			return nil, 0, err
		}
		seen := map[string]struct{}{}
		fingerprints := make([]BrowserFingerprintLogin, 0)
		for _, log := range logs {
			other, _ := common.StrToMap(log.Other)
			value, _ := other["browser_fingerprint"].(string)
			value, err := NormalizeBrowserFingerprintHash(value)
			if err != nil {
				continue
			}
			if _, ok := seen[value]; ok {
				continue
			}
			seen[value] = struct{}{}
			fingerprints = append(fingerprints, BrowserFingerprintLogin{FingerprintHash: value, LastSeenAt: log.CreatedAt})
		}
		result = append(result, BrowserFingerprintUser{Id: user.Id, Username: user.Username, DisplayName: user.DisplayName, Email: user.Email, Fingerprints: fingerprints})
	}
	return result, total, nil
}

func GetBrowserFingerprintBanByID(id int) (*BrowserFingerprintBan, error) {
	ban := &BrowserFingerprintBan{}
	if err := DB.First(ban, id).Error; err != nil {
		return nil, err
	}
	return ban, nil
}

func validateBrowserFingerprintTarget(hash string, targetUserID int) (string, string, error) {
	fingerprintHash, err := HashBrowserFingerprint(hash)
	if err != nil {
		return "", "", err
	}
	if targetUserID <= 0 {
		return fingerprintHash, "", nil
	}
	user, err := GetUserById(targetUserID, false)
	if err != nil {
		return "", "", errors.New("target user not found")
	}
	if LOG_DB == nil {
		return "", "", errors.New("login database is unavailable")
	}
	var logs []Log
	if err := LOG_DB.Where("user_id = ? AND type = ?", targetUserID, LogTypeLogin).Order("created_at DESC, id DESC").Limit(200).Find(&logs).Error; err != nil {
		return "", "", err
	}
	for _, log := range logs {
		other, _ := common.StrToMap(log.Other)
		value, _ := other["browser_fingerprint"].(string)
		value, normalizeErr := NormalizeBrowserFingerprintHash(value)
		if normalizeErr == nil && value == fingerprintHash {
			return fingerprintHash, user.Username, nil
		}
	}
	return "", "", errors.New("fingerprint is not a successful login fingerprint for target user")
}

func CreateBrowserFingerprintBan(ban *BrowserFingerprintBan) error {
	if ban == nil {
		return errors.New("browser fingerprint ban is nil")
	}
	fingerprintHash, username, err := validateBrowserFingerprintTarget(ban.FingerprintHash, ban.TargetUserId)
	if err != nil {
		return err
	}
	ban.FingerprintHash = fingerprintHash
	ban.TargetUsername = username
	if ban.TargetUserId <= 0 {
		ban.TargetUserId = 0
	}
	now := common.GetTimestamp()
	ban.CreatedAt = now
	ban.UpdatedAt = now
	if err := DB.Create(ban).Error; err != nil {
		return err
	}
	InvalidateBrowserFingerprintBanSnapshot()
	return nil
}

func UpdateBrowserFingerprintBan(id int, fingerprintHash, reason string, enabled bool, expiresAt int64, targetUserID, operatorId int) (*BrowserFingerprintBan, error) {
	hashedFingerprint, targetUsername, err := validateBrowserFingerprintTarget(fingerprintHash, targetUserID)
	if err != nil {
		return nil, err
	}
	updates := map[string]any{
		"fingerprint_hash": hashedFingerprint,
		"reason":           strings.TrimSpace(reason),
		"enabled":          enabled,
		"expires_at":       expiresAt,
		"target_user_id":   targetUserID,
		"target_username":  targetUsername,
		"updated_at":       common.GetTimestamp(),
		"operator_id":      operatorId,
	}
	result := DB.Model(&BrowserFingerprintBan{}).Where("id = ?", id).Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	InvalidateBrowserFingerprintBanSnapshot()
	return GetBrowserFingerprintBanByID(id)
}

func DeleteBrowserFingerprintBan(id int) error {
	result := DB.Delete(&BrowserFingerprintBan{}, id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	InvalidateBrowserFingerprintBanSnapshot()
	return nil
}

func ToggleBrowserFingerprintBan(id, operatorId int) (*BrowserFingerprintBan, error) {
	var updated *BrowserFingerprintBan
	err := DB.Transaction(func(tx *gorm.DB) error {
		ban := &BrowserFingerprintBan{}
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
	InvalidateBrowserFingerprintBanSnapshot()
	return updated, nil
}

func InvalidateBrowserFingerprintBanSnapshot() {
	browserFingerprintSnapshot.Lock()
	browserFingerprintSnapshot.loadedAt = time.Time{}
	browserFingerprintSnapshot.bans = nil
	browserFingerprintSnapshot.Unlock()
}

func MatchBrowserFingerprint(fingerprint string, now time.Time) (*BrowserFingerprintBan, error) {
	hashedFingerprint, err := HashBrowserFingerprint(fingerprint)
	if err != nil {
		return nil, nil
	}
	browserFingerprintSnapshot.RLock()
	if !browserFingerprintSnapshot.loadedAt.IsZero() && now.Sub(browserFingerprintSnapshot.loadedAt) < browserFingerprintBanSnapshotTTL {
		ban := matchBrowserFingerprintHash(hashedFingerprint, browserFingerprintSnapshot.bans)
		browserFingerprintSnapshot.RUnlock()
		return ban, nil
	}
	browserFingerprintSnapshot.RUnlock()

	browserFingerprintSnapshot.Lock()
	defer browserFingerprintSnapshot.Unlock()
	if !browserFingerprintSnapshot.loadedAt.IsZero() && now.Sub(browserFingerprintSnapshot.loadedAt) < browserFingerprintBanSnapshotTTL {
		return matchBrowserFingerprintHash(hashedFingerprint, browserFingerprintSnapshot.bans), nil
	}
	var bans []BrowserFingerprintBan
	if err := DB.Where("enabled = ? AND (expires_at = ? OR expires_at > ?)", true, 0, now.Unix()).Order("id DESC").Find(&bans).Error; err != nil {
		return nil, err
	}
	browserFingerprintSnapshot.bans = bans
	browserFingerprintSnapshot.loadedAt = now
	return matchBrowserFingerprintHash(hashedFingerprint, bans), nil
}

func matchBrowserFingerprintHash(hash string, bans []BrowserFingerprintBan) *BrowserFingerprintBan {
	for _, ban := range bans {
		if ban.FingerprintHash == hash {
			matched := ban
			return &matched
		}
	}
	return nil
}

func IsBrowserFingerprintBanned(fingerprint string, now time.Time) (bool, error) {
	ban, err := MatchBrowserFingerprint(fingerprint, now)
	return ban != nil, err
}

func ValidateBrowserFingerprintHash(value string) error {
	if _, err := NormalizeBrowserFingerprintHash(value); err != nil {
		return fmt.Errorf("invalid browser fingerprint: %w", err)
	}
	return nil
}
