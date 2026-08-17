package model

import (
	"errors"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/QuantumNous/new-api/common"
	sqlitedriver "github.com/glebarez/go-sqlite"
	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm/logger"

	"github.com/ClickHouse/clickhouse-go/v2/lib/proto"
	"github.com/go-sql-driver/mysql"
)

// --- P0 enhancement: configurable slow-query threshold + SQL error sanitization ---
// This file is new code ported from MAakber/new-api model/gorm_logger.go.
// It introduces:
//   1. SQL_SLOW_THRESHOLD_MS env var (default 200ms, 0 disables slow query log)
//   2. Parameterized query filtering when DEBUG is off
//   3. Database driver error sanitization (MySQL/PostgreSQL/ClickHouse/SQLite)
//
// The old newGormLogger(level) signature in main.go is preserved unchanged;
// it now delegates to the helpers in this file.

const (
	defaultSlowThresholdMs = 200
	maxSlowThresholdMs     = 60 * 60 * 1000
)

// gormSlowThreshold returns the configured slow-query threshold duration,
// read from the SQL_SLOW_THRESHOLD_MS environment variable.
func gormSlowThreshold() time.Duration {
	slowThresholdMs := common.GetEnvOrDefault("SQL_SLOW_THRESHOLD_MS", defaultSlowThresholdMs)
	if slowThresholdMs < 0 || slowThresholdMs > maxSlowThresholdMs {
		common.SysError(fmt.Sprintf("invalid SQL_SLOW_THRESHOLD_MS %d (allowed 0-%d, 0 disables slow query log), using default %d", slowThresholdMs, maxSlowThresholdMs, defaultSlowThresholdMs))
		slowThresholdMs = defaultSlowThresholdMs
	}
	return time.Duration(slowThresholdMs) * time.Millisecond
}

// newGormLoggerEnhanced creates a GORM logger with configurable slow-query
// threshold, parameterized query filtering, and driver error sanitization.
// writer is the output destination (typically os.Stdout).
// level controls the GORM log verbosity.
func newGormLoggerEnhanced(w io.Writer, level logger.LogLevel) logger.Interface {
	return logger.New(
		&sanitizedLogWriter{delegate: log.New(w, "\r\n", log.LstdFlags)},
		logger.Config{
			SlowThreshold:             gormSlowThreshold(),
			LogLevel:                  level,
			IgnoreRecordNotFoundError: true,
			ParameterizedQueries:      !common.DebugEnabled,
			Colorful:                   true,
		},
	)
}

// sanitizedLogWriter wraps a *log.Logger and sanitizes database driver errors
// that may contain inline data values. When DEBUG=true, errors are passed
// through unchanged for full diagnostic output.
type sanitizedLogWriter struct {
	delegate *log.Logger
}

func (s *sanitizedLogWriter) Printf(format string, args ...interface{}) {
	if !common.DebugEnabled {
		for i, arg := range args {
			if err, ok := arg.(error); ok {
				args[i] = sanitizeDBError(err)
			}
		}
	}
	s.delegate.Printf(format, args...)
}

// sanitizeDBError collapses database server-side driver errors (which may
// contain inline data values) into a safe code-only message. Network/context
// errors that never carry query data are passed through unchanged.
func sanitizeDBError(err error) error {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return fmt.Errorf("mysql error %d", mysqlErr.Number)
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return fmt.Errorf("postgres error SQLSTATE %s", pgErr.Code)
	}
	var chErr *proto.Exception
	if errors.As(err, &chErr) {
		return fmt.Errorf("clickhouse error %d", chErr.Code)
	}
	var sqliteErr *sqlitedriver.Error
	if errors.As(err, &sqliteErr) {
		return fmt.Errorf("sqlite error %d", sqliteErr.Code())
	}
	return err
}
