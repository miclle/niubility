package service

import (
	"context"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
)

const (
	nativeDumpBatchSize        = 2000
	nativeDumpThrottleInterval = 10 * time.Millisecond
)

// dumpDatabaseNative exports the database using pure Go SQL queries.
// It opens an isolated connection (outside the GORM pool), runs inside a
// REPEATABLE READ read-only transaction, and writes standard SQL to w.
func (s *Service) dumpDatabaseNative(ctx context.Context, dialect string, info *dbConnectionInfo, w io.Writer) error {
	db, err := openIsolatedConn(dialect, info)
	if err != nil {
		return fmt.Errorf("open isolated connection: %w", err)
	}
	defer func() {
		_ = db.Close()
	}()

	tx, err := beginReadOnlyTx(ctx, db)
	if err != nil {
		return fmt.Errorf("begin read-only transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if err := writeHeader(w, dialect); err != nil {
		return err
	}

	tables, err := listUserTables(ctx, tx, dialect)
	if err != nil {
		return fmt.Errorf("list tables: %w", err)
	}

	for _, table := range tables {
		if err := dumpTable(ctx, tx, w, dialect, table); err != nil {
			return fmt.Errorf("dump table %s: %w", table, err)
		}
	}

	return writeFooter(w, dialect)
}

// openIsolatedConn opens a standalone database/sql connection that does not
// share the GORM connection pool. Limited to a single connection.
func openIsolatedConn(dialect string, info *dbConnectionInfo) (*sql.DB, error) {
	var driverName, dsn string
	switch dialect {
	case "mysql":
		driverName = "mysql"
		cfg := mysql.NewConfig()
		cfg.User = info.User
		cfg.Passwd = info.Password
		cfg.Net = "tcp"
		cfg.Addr = info.Host + ":" + info.Port
		cfg.DBName = info.Database
		cfg.ParseTime = true
		cfg.Params = map[string]string{"charset": "utf8mb4"}
		dsn = cfg.FormatDSN()
	default:
		driverName = "pgx"
		u := &url.URL{
			Scheme: "postgres",
			User:   url.UserPassword(info.User, info.Password),
			Host:   info.Host + ":" + info.Port,
			Path:   info.Database,
		}
		if info.SSLMode != "" {
			u.RawQuery = "sslmode=" + url.QueryEscape(info.SSLMode)
		}
		dsn = u.String()
	}

	db, err := sql.Open(driverName, dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	return db, nil
}

// beginReadOnlyTx starts a REPEATABLE READ, read-only transaction.
func beginReadOnlyTx(ctx context.Context, db *sql.DB) (*sql.Tx, error) {
	tx, err := db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelRepeatableRead,
		ReadOnly:  true,
	})
	if err != nil {
		return nil, err
	}
	return tx, nil
}

// writeHeader writes the SQL dump preamble.
func writeHeader(w io.Writer, dialect string) error {
	lines := []string{
		"-- Niubility Database Backup (Go builtin exporter)",
		fmt.Sprintf("-- Generated at: %s", time.Now().UTC().Format(time.RFC3339)),
		fmt.Sprintf("-- Database type: %s", dialect),
		"--",
	}
	if dialect == "mysql" {
		lines = append(lines,
			"SET NAMES utf8mb4;",
			"SET FOREIGN_KEY_CHECKS = 0;",
			"SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
		)
	} else {
		lines = append(lines,
			"SET client_encoding = 'UTF8';",
			"SET standard_conforming_strings = on;",
		)
	}
	lines = append(lines, "")
	_, err := fmt.Fprintln(w, strings.Join(lines, "\n"))
	return err
}

// writeFooter writes the SQL dump epilogue.
func writeFooter(w io.Writer, dialect string) error {
	var lines []string
	if dialect == "mysql" {
		lines = append(lines, "SET FOREIGN_KEY_CHECKS = 1;")
	}
	lines = append(lines, "-- Dump completed")
	_, err := fmt.Fprintln(w, strings.Join(lines, "\n"))
	return err
}

// listUserTables returns application-owned table names.
func listUserTables(ctx context.Context, tx *sql.Tx, dialect string) ([]string, error) {
	var query string
	switch dialect {
	case "mysql":
		query = "SHOW TABLES"
	default:
		query = "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
	}

	rows, err := tx.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()

	var tables []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		tables = append(tables, name)
	}
	return tables, rows.Err()
}

// dumpTable exports a single table's DDL and data.
func dumpTable(ctx context.Context, tx *sql.Tx, w io.Writer, dialect, table string) error {
	if _, err := fmt.Fprintf(w, "\n-- Table: %s\n", table); err != nil {
		return err
	}

	if err := dumpTableDDL(ctx, tx, w, dialect, table); err != nil {
		return fmt.Errorf("ddl: %w", err)
	}

	return dumpTableData(ctx, tx, w, dialect, table)
}

// dumpTableDDL exports CREATE TABLE statement.
func dumpTableDDL(ctx context.Context, tx *sql.Tx, w io.Writer, dialect, table string) error {
	if _, err := fmt.Fprintf(w, "DROP TABLE IF EXISTS %s;\n", quoteIdentifier(dialect, table)); err != nil {
		return err
	}

	switch dialect {
	case "mysql":
		return dumpMySQLTableDDL(ctx, tx, w, table)
	default:
		return dumpPostgresTableDDL(ctx, tx, w, table)
	}
}

// dumpMySQLTableDDL uses SHOW CREATE TABLE for MySQL.
func dumpMySQLTableDDL(ctx context.Context, tx *sql.Tx, w io.Writer, table string) error {
	var tableName, createSQL string
	if err := tx.QueryRowContext(ctx, "SHOW CREATE TABLE "+quoteIdentifier("mysql", table)).Scan(&tableName, &createSQL); err != nil {
		return err
	}
	_, err := fmt.Fprintf(w, "%s;\n\n", createSQL)
	return err
}

// dumpPostgresTableDDL reconstructs CREATE TABLE from information_schema.
func dumpPostgresTableDDL(ctx context.Context, tx *sql.Tx, w io.Writer, table string) error {
	// Build column definitions
	rows, err := tx.QueryContext(ctx, `
		SELECT column_name, data_type, character_maximum_length,
		       column_default, is_nullable, udt_name
		FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = $1
		ORDER BY ordinal_position`, table)
	if err != nil {
		return fmt.Errorf("query columns: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	var columns []string
	for rows.Next() {
		var colName, dataType, isNullable, udtName string
		var charMaxLen *int64
		var colDefault *string
		if err := rows.Scan(&colName, &dataType, &charMaxLen, &colDefault, &isNullable, &udtName); err != nil {
			return fmt.Errorf("scan column: %w", err)
		}

		col := fmt.Sprintf("    %s %s", quoteIdentifier("postgres", colName), pgColumnType(dataType, udtName, charMaxLen))
		if colDefault != nil {
			col += " DEFAULT " + *colDefault
		}
		if isNullable == "NO" {
			col += " NOT NULL"
		}
		columns = append(columns, col)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// Add constraints
	constraintRows, err := tx.QueryContext(ctx, `
		SELECT conname, pg_get_constraintdef(oid)
		FROM pg_constraint
		WHERE conrelid = $1::regclass
		ORDER BY contype, conname`, table)
	if err != nil {
		return fmt.Errorf("query constraints: %w", err)
	}
	defer func() {
		_ = constraintRows.Close()
	}()

	for constraintRows.Next() {
		var conName, conDef string
		if err := constraintRows.Scan(&conName, &conDef); err != nil {
			return fmt.Errorf("scan constraint: %w", err)
		}
		columns = append(columns, fmt.Sprintf("    CONSTRAINT %s %s",
			quoteIdentifier("postgres", conName), conDef))
	}
	if err := constraintRows.Err(); err != nil {
		return err
	}

	if _, err := fmt.Fprintf(w, "CREATE TABLE %s (\n%s\n);\n",
		quoteIdentifier("postgres", table), strings.Join(columns, ",\n")); err != nil {
		return err
	}

	// Add indexes (excluding those already covered by constraints)
	return dumpPostgresIndexes(ctx, tx, w, table)
}

// dumpPostgresIndexes exports CREATE INDEX statements.
func dumpPostgresIndexes(ctx context.Context, tx *sql.Tx, w io.Writer, table string) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT indexdef
		FROM pg_indexes
		WHERE schemaname = 'public' AND tablename = $1
		  AND indexname NOT IN (
		      SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass
		  )
		ORDER BY indexname`, table)
	if err != nil {
		return fmt.Errorf("query indexes: %w", err)
	}
	defer func() {
		_ = rows.Close()
	}()

	for rows.Next() {
		var indexDef string
		if err := rows.Scan(&indexDef); err != nil {
			return fmt.Errorf("scan index: %w", err)
		}
		if _, err := fmt.Fprintf(w, "%s;\n", indexDef); err != nil {
			return err
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	_, err = fmt.Fprintln(w)
	return err
}

// pgColumnType maps information_schema data_type/udt_name to a SQL type string.
func pgColumnType(dataType, udtName string, charMaxLen *int64) string {
	switch dataType {
	case "character varying":
		if charMaxLen != nil {
			return fmt.Sprintf("varchar(%d)", *charMaxLen)
		}
		return "varchar"
	case "character":
		if charMaxLen != nil {
			return fmt.Sprintf("char(%d)", *charMaxLen)
		}
		return "char"
	case "USER-DEFINED":
		return udtName
	default:
		return dataType
	}
}

// dumpTableData exports table rows as INSERT statements in batches.
func dumpTableData(ctx context.Context, tx *sql.Tx, w io.Writer, dialect, table string) error {
	quotedTable := quoteIdentifier(dialect, table)

	// Get column names for the INSERT header
	colNames, err := getColumnNames(ctx, tx, dialect, table)
	if err != nil {
		return fmt.Errorf("get columns: %w", err)
	}
	if len(colNames) == 0 {
		return nil
	}

	// Build INSERT header once — it is constant across all batches
	quotedCols := make([]string, len(colNames))
	for i, c := range colNames {
		quotedCols[i] = quoteIdentifier(dialect, c)
	}
	insertHeader := fmt.Sprintf("INSERT INTO %s (%s) VALUES\n", quotedTable, strings.Join(quotedCols, ", "))

	offset := 0
	for {
		query := fmt.Sprintf("SELECT * FROM %s ORDER BY 1 LIMIT %d OFFSET %d", quotedTable, nativeDumpBatchSize, offset)
		rows, err := tx.QueryContext(ctx, query)
		if err != nil {
			return fmt.Errorf("query data: %w", err)
		}

		var batchValues []string
		for rows.Next() {
			vals := makeRowScanDest(len(colNames))
			if err := rows.Scan(vals...); err != nil {
				_ = rows.Close()
				return fmt.Errorf("scan row: %w", err)
			}
			formatted := formatRowValues(vals, dialect)
			batchValues = append(batchValues, "("+strings.Join(formatted, ", ")+")")
		}
		if err := rows.Err(); err != nil {
			_ = rows.Close()
			return err
		}
		_ = rows.Close()

		if len(batchValues) == 0 {
			break
		}

		if _, err := fmt.Fprintf(w, "%s%s;\n", insertHeader, strings.Join(batchValues, ",\n")); err != nil {
			return err
		}

		if len(batchValues) < nativeDumpBatchSize {
			break
		}
		offset += nativeDumpBatchSize

		// Throttle to reduce impact on the running service
		time.Sleep(nativeDumpThrottleInterval)
	}

	return nil
}

// getColumnNames returns the column names for a table.
func getColumnNames(ctx context.Context, tx *sql.Tx, dialect, table string) ([]string, error) {
	quotedTable := quoteIdentifier(dialect, table)
	rows, err := tx.QueryContext(ctx, fmt.Sprintf("SELECT * FROM %s LIMIT 0", quotedTable))
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()
	return rows.Columns()
}

// makeRowScanDest creates a slice of *any pointers for rows.Scan.
func makeRowScanDest(n int) []any {
	dest := make([]any, n)
	for i := range dest {
		var v any
		dest[i] = &v
	}
	return dest
}

// formatRowValues converts scanned row values to SQL literal strings.
func formatRowValues(vals []any, dialect string) []string {
	result := make([]string, len(vals))
	for i, raw := range vals {
		v := *(raw.(*any))
		result[i] = formatSQLValue(v, dialect)
	}
	return result
}

// formatSQLValue converts a single Go value to its SQL literal representation.
func formatSQLValue(v any, dialect string) string {
	if v == nil {
		return "NULL"
	}

	switch val := v.(type) {
	case bool:
		if dialect == "mysql" {
			if val {
				return "1"
			}
			return "0"
		}
		if val {
			return "TRUE"
		}
		return "FALSE"

	case int64:
		return fmt.Sprintf("%d", val)

	case float64:
		return fmt.Sprintf("%g", val)

	case []byte:
		if len(val) == 0 {
			return escapeSQLString("", dialect)
		}
		// Check if it looks like printable text
		if isPrintableText(val) {
			return escapeSQLString(string(val), dialect)
		}
		// Binary data
		if dialect == "mysql" {
			return "X'" + hex.EncodeToString(val) + "'"
		}
		return `E'\x` + hex.EncodeToString(val) + "'"

	case string:
		return escapeSQLString(val, dialect)

	case time.Time:
		return escapeSQLString(val.Format("2006-01-02 15:04:05.999999"), dialect)

	default:
		return escapeSQLString(fmt.Sprintf("%v", val), dialect)
	}
}

// escapeSQLString wraps a string in single quotes with proper escaping.
func escapeSQLString(s, dialect string) string {
	if dialect == "mysql" {
		s = strings.ReplaceAll(s, `\`, `\\`)
		s = strings.ReplaceAll(s, "'", `\'`)
		return "'" + s + "'"
	}
	// PostgreSQL: double single quotes
	s = strings.ReplaceAll(s, "'", "''")
	return "'" + s + "'"
}

// quoteIdentifier wraps a table or column name in dialect-appropriate quotes.
func quoteIdentifier(dialect, name string) string {
	if dialect == "mysql" {
		return "`" + strings.ReplaceAll(name, "`", "``") + "`"
	}
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// isPrintableText returns true if the byte slice is valid UTF-8 with no null bytes.
func isPrintableText(b []byte) bool {
	if !utf8.Valid(b) {
		return false
	}
	for _, c := range b {
		if c == 0 {
			return false
		}
	}
	return true
}
