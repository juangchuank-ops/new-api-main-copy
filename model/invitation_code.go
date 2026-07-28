package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

var ErrInvitationCodeUnavailable = errors.New("invitation code is invalid or unavailable")

type InvitationCode struct {
	Id          int            `json:"id"`
	UserId      int            `json:"user_id"` // admin who created
	Key         string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status      int            `json:"status" gorm:"default:1"` // 1=enabled, 2=disabled, 3=used
	Name        string         `json:"name" gorm:"index"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UsedTime    int64          `json:"used_time" gorm:"bigint"`
	UsedUserId  int            `json:"used_user_id"`       // user who used the code to register
	Count       int            `json:"count" gorm:"-:all"` // batch count, API only
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func GetAllInvitationCodes(startIdx int, num int) (invitationCodes []*InvitationCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	err = tx.Model(&InvitationCode{}).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = tx.Order("id desc").Limit(num).Offset(startIdx).Find(&invitationCodes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return invitationCodes, total, nil
}

func SearchInvitationCodes(keyword string, startIdx int, num int) (invitationCodes []*InvitationCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&InvitationCode{})

	if id, err := strconv.Atoi(keyword); err == nil {
		query = query.Where("id = ? OR name LIKE ?", id, keyword+"%")
	} else {
		query = query.Where("name LIKE ?", keyword+"%")
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&invitationCodes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return invitationCodes, total, nil
}

func GetInvitationCodeById(id int) (*InvitationCode, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	invitationCode := InvitationCode{Id: id}
	var err error = nil
	err = DB.First(&invitationCode, "id = ?", id).Error
	return &invitationCode, err
}

func GetInvitationCodeByKey(key string) (*InvitationCode, error) {
	if key == "" {
		return nil, errors.New("key 为空！")
	}
	invitationCode := InvitationCode{}
	keyCol := "`key`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		keyCol = `"key"`
	}
	err := DB.Where(keyCol+" = ?", key).First(&invitationCode).Error
	return &invitationCode, err
}

func (c *InvitationCode) Insert() error {
	var err error
	err = DB.Create(c).Error
	return err
}

func (c *InvitationCode) Update() error {
	var err error
	err = DB.Model(c).Select("name", "status").Updates(c).Error
	return err
}

func DeleteInvitationCodeById(id int) error {
	if id == 0 {
		return errors.New("id 为空！")
	}
	invitationCode := InvitationCode{Id: id}
	err := DB.Where(&invitationCode).First(&invitationCode).Error
	if err != nil {
		return err
	}
	return DB.Delete(&invitationCode).Error
}

func DeleteInvalidInvitationCodes() (int64, error) {
	result := DB.Where("status IN ?", []int{common.InvitationCodeStatusUsed, common.InvitationCodeStatusDisabled}).Delete(&InvitationCode{})
	return result.RowsAffected, result.Error
}

func GetUserInvitationCodes(userId int, startIdx int, num int) (invitationCodes []*InvitationCode, total int64, err error) {
	if userId <= 0 {
		return nil, 0, errors.New("invalid user id")
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&InvitationCode{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
			return err
		}
		return tx.Where("user_id = ?", userId).
			Order("id desc").
			Limit(num).
			Offset(startIdx).
			Find(&invitationCodes).Error
	})
	return invitationCodes, total, err
}

func GetUserAvailableInvitationCodeKeys(userId int) ([]string, error) {
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}

	var keys []string
	err := DB.Model(&InvitationCode{}).
		Where("user_id = ? AND status = ?", userId, common.InvitationCodeStatusEnabled).
		Order("id desc").
		Pluck("key", &keys).Error
	return keys, err
}

func DeleteUserInvitationCodes(userId int, ids []int) (int64, error) {
	if userId <= 0 {
		return 0, errors.New("invalid user id")
	}
	if len(ids) == 0 {
		return 0, errors.New("invitation code ids are required")
	}

	result := DB.Where("user_id = ? AND id IN ?", userId, ids).Delete(&InvitationCode{})
	return result.RowsAffected, result.Error
}

func DeleteUserUsedInvitationCodes(userId int) (int64, error) {
	if userId <= 0 {
		return 0, errors.New("invalid user id")
	}

	result := DB.Where("user_id = ? AND status = ?", userId, common.InvitationCodeStatusUsed).
		Delete(&InvitationCode{})
	return result.RowsAffected, result.Error
}

// ValidateInvitationCode checks if an invitation code exists and is enabled (status=1).
func ValidateInvitationCode(key string) (*InvitationCode, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return nil, ErrInvitationCodeUnavailable
	}
	invitationCode := &InvitationCode{}
	err := DB.Where(commonKeyCol+" = ? AND status = ?", key, common.InvitationCodeStatusEnabled).First(invitationCode).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrInvitationCodeUnavailable
		}
		return nil, err
	}
	return invitationCode, nil
}

// UseInvitationCodeWithTx atomically consumes an enabled invitation code in an existing transaction.
func UseInvitationCodeWithTx(tx *gorm.DB, key string, userId int) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return ErrInvitationCodeUnavailable
	}
	if userId == 0 {
		return errors.New("无效的 user id")
	}
	if tx == nil {
		return errors.New("database transaction is required")
	}

	result := tx.Model(&InvitationCode{}).
		Where(commonKeyCol+" = ? AND status = ?", key, common.InvitationCodeStatusEnabled).
		Updates(map[string]any{
			"status":       common.InvitationCodeStatusUsed,
			"used_time":    common.GetTimestamp(),
			"used_user_id": userId,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrInvitationCodeUnavailable
	}
	return nil
}

// UseInvitationCode atomically marks an invitation code as used with the given userId.
func UseInvitationCode(key string, userId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return UseInvitationCodeWithTx(tx, key, userId)
	})
}

// GenerateInvitationCodesForUser creates `count` invitation codes owned by `userId`.
// Used when a user purchases invitation codes via payment channels.
func GenerateInvitationCodesForUser(userId int, count int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		for i := 0; i < count; i++ {
			code := InvitationCode{
				Key:         common.GetUUID(),
				UserId:      userId,
				Name:        "购买邀请码",
				Status:      common.InvitationCodeStatusEnabled,
				CreatedTime: common.GetTimestamp(),
			}
			if err := tx.Create(&code).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
