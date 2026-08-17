package model

import (
	"gorm.io/gorm"
)

// This file provides compatibility stubs for AuthSession-dependent functions
// referenced by the AutoBan system. The old version uses NewApiUserAuth and
// does not implement session-based revocation or Redis auth-version fencing.
// These stubs preserve old behavior: the ban still takes effect via the
// auto_ban_until column checked by the auth middleware, but no session
// revocation or cache fencing is performed.

// IncrementUserAuthVersionWithTx is a no-op stub. The old version has no
// auth_version Redis fencing. Returns (1, nil) so callers treat the bump as
// successful without requiring a schema migration for auth_version.
func IncrementUserAuthVersionWithTx(tx *gorm.DB, userId int) (int64, error) {
	_ = tx
	_ = userId
	return 1, nil
}

// PublishUserAuthCache refreshes the old user cache after a ban state change.
// The old version uses invalidateUserCache (Redis hash delete) so the next
// read repopulates from the database.
func PublishUserAuthCache(userId int) error {
	return invalidateUserCache(userId)
}

// RevokeAllUserSessions is a no-op stub. The old version uses NewApiUserAuth
// (token-based) rather than server-side sessions, so there are no sessions to
// revoke. Returns (0, nil).
func RevokeAllUserSessions(userId int, reason string) (int, error) {
	_ = userId
	_ = reason
	return 0, nil
}
