package model

// RankingUserIP aggregates per-user IP diversity and request volume from the
// logs table. Used by the security ranking endpoint to identify accounts that
// are sourcing requests from many distinct IP addresses.
type RankingUserIP struct {
	UserID       int    `gorm:"column:user_id" json:"user_id"`
	Username     string `gorm:"column:username" json:"username"`
	IPCount      int64  `gorm:"column:ip_count" json:"ip_count"`
	RequestCount int64  `gorm:"column:request_count" json:"request_count"`
	LastSeen     int64  `gorm:"column:last_seen" json:"last_seen"`
}

// GetRankingUserIPs returns the top N users ranked by distinct IP count and
// request volume within the given time range. Only consume-type logs with a
// non-empty IP and user_id > 0 are considered.
func GetRankingUserIPs(startTime int64, endTime int64, limit int) ([]RankingUserIP, error) {
	if limit <= 0 {
		limit = 20
	}
	var rows []RankingUserIP
	query := LOG_DB.Model(&Log{}).
		Select("user_id, MAX(username) AS username, COUNT(DISTINCT ip) AS ip_count, COUNT(*) AS request_count, MAX(created_at) AS last_seen").
		Where("type = ? AND user_id > 0 AND ip <> ''", LogTypeConsume).
		Group("user_id").
		Order("ip_count DESC, request_count DESC, user_id ASC").
		Limit(limit)
	if startTime > 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime > 0 {
		query = query.Where("created_at <= ?", endTime)
	}
	err := query.Find(&rows).Error
	return rows, err
}
