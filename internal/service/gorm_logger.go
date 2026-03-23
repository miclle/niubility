package service

import (
	"context"
	"errors"
	"time"

	foxlogger "github.com/fox-gonic/fox/logger"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// defaultSlowThreshold is the default threshold for slow SQL queries.
var defaultSlowThreshold = 200 * time.Millisecond

// gormLog implements gorm's logger.Interface, bridging GORM SQL logs to fox logger.
// It extracts the trace ID from context to ensure SQL logs carry the same request ID
// as the rest of the request processing chain.
type gormLog struct {
	foxlogger.Logger
	slowThreshold time.Duration
}

// newGormLogger creates a new gormLog with the given slow query threshold.
func newGormLogger(slow time.Duration) *gormLog {
	log := foxlogger.NewWithoutCaller("").Caller(6).WithFields(map[string]any{"type": "DATABASE"})
	if slow <= 0 {
		slow = defaultSlowThreshold
	}
	return &gormLog{Logger: log, slowThreshold: slow}
}

// fromContext returns a fox logger enriched with the request trace ID from context.
func (l *gormLog) fromContext(ctx context.Context) foxlogger.Logger {
	if requestID, ok := ctx.Value(foxlogger.TraceID).(string); ok {
		return l.WithFields(map[string]any{foxlogger.TraceID: requestID})
	}
	if requestID, ok := ctx.Value(foxlogger.TraceIDKey).(string); ok {
		return l.WithFields(map[string]any{foxlogger.TraceID: requestID})
	}
	return l.Logger
}

// LogMode implements gorm's logger.Interface.
func (l *gormLog) LogMode(lvl gormlogger.LogLevel) gormlogger.Interface {
	var level foxlogger.Level
	switch lvl {
	case gormlogger.Error:
		level = foxlogger.ErrorLevel
	case gormlogger.Warn:
		level = foxlogger.WarnLevel
	case gormlogger.Info:
		level = foxlogger.InfoLevel
	case gormlogger.Silent:
		level = foxlogger.Disabled
	default:
		level = foxlogger.TraceLevel
	}
	return &gormLog{
		Logger:        l.Logger.SetLevel(level),
		slowThreshold: l.slowThreshold,
	}
}

// Info implements gorm's logger.Interface.
func (l *gormLog) Info(ctx context.Context, s string, vals ...any) {
	l.fromContext(ctx).Infof(s, vals...)
}

// Warn implements gorm's logger.Interface.
func (l *gormLog) Warn(ctx context.Context, s string, vals ...any) {
	l.fromContext(ctx).Warnf(s, vals...)
}

// Error implements gorm's logger.Interface.
func (l *gormLog) Error(ctx context.Context, s string, vals ...any) {
	l.fromContext(ctx).Errorf(s, vals...)
}

// Trace implements gorm's logger.Interface.
func (l *gormLog) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	var (
		elapsed   = time.Since(begin)
		sql, rows = fc()
		fields    = map[string]any{
			"latency":       elapsed.String(),
			"sql":           truncateSQL(sql, 1024),
			"rows_affected": rows,
		}
		log = l.fromContext(ctx)
	)

	switch {
	case err != nil && !errors.Is(err, gorm.ErrRecordNotFound):
		log.WithFields(fields).Errorf("%v", err)
	case elapsed > l.slowThreshold:
		fields["slow_query"] = true
		log.WithFields(fields).Warnf("Elapsed %s exceeded, Max %s", elapsed.String(), l.slowThreshold.String())
	default:
		log.WithFields(fields).Info()
	}
}

// truncateSQL truncates a SQL string to maxLen characters, appending "..." if truncated.
func truncateSQL(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
