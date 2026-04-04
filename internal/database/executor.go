package database

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"oracle_client_soft/internal/models"

	"github.com/godror/godror"
)

const (
	defaultQueryTimeout = 60 * time.Second
	defaultMaxRows      = 500
)

// StatementKind classifies the first executable statement (after leading comments/whitespace).
type StatementKind int

const (
	KindUnknown StatementKind = iota
	KindQuery
	KindDML
	KindPLSQL
)

// QueryExecutor runs SQL against pools held by a ConnectionManager.
type QueryExecutor struct {
	mgr *ConnectionManager
}

// NewQueryExecutor constructs an executor bound to mgr.
func NewQueryExecutor(mgr *ConnectionManager) *QueryExecutor {
	if mgr == nil {
		panic("database: NewQueryExecutor(nil)")
	}
	return &QueryExecutor{mgr: mgr}
}

func (e *QueryExecutor) resolveDB(connID string) (*sql.DB, error) {
	id := strings.TrimSpace(connID)
	if id == "" {
		id = e.mgr.ActiveConnectionID()
	}
	if id == "" {
		return nil, errors.New("no connection: pass connID or connect and set an active connection")
	}
	db := e.mgr.ConnectionByID(id)
	if db == nil {
		return nil, fmt.Errorf("not connected: %s", id)
	}
	return db, nil
}

func clampMaxRows(maxRows int) int {
	if maxRows <= 0 {
		return defaultMaxRows
	}
	return maxRows
}

// stripLeadingNoise trims whitespace and leading SQL line/block comments.
func stripLeadingNoise(s string) string {
	s = strings.TrimSpace(s)
	for len(s) > 0 {
		if strings.HasPrefix(s, "--") {
			if nl := strings.IndexByte(s, '\n'); nl >= 0 {
				s = strings.TrimSpace(s[nl+1:])
				continue
			}
			return ""
		}
		if strings.HasPrefix(s, "/*") {
			if end := strings.Index(s, "*/"); end >= 0 {
				s = strings.TrimSpace(s[end+2:])
				continue
			}
			break
		}
		break
	}
	return s
}

// ClassifyStatement detects query vs DML vs anonymous PL/SQL for the editor “run” action.
func ClassifyStatement(sql string) StatementKind {
	s := stripLeadingNoise(sql)
	if s == "" {
		return KindUnknown
	}
	u := strings.ToUpper(s)
	if strings.HasPrefix(u, "BEGIN") || strings.HasPrefix(u, "DECLARE") {
		return KindPLSQL
	}
	if strings.HasPrefix(u, "SELECT") || strings.HasPrefix(u, "WITH") {
		return KindQuery
	}
	// INSERT, UPDATE, DELETE, MERGE, DDL, CALL, TRUNCATE, etc. → Exec path
	return KindDML
}

// ExecuteQuery runs a SELECT-style statement and returns up to maxRows rows (default 500).
func (e *QueryExecutor) ExecuteQuery(connID, sql string, maxRows int) (*models.QueryResult, error) {
	db, err := e.resolveDB(connID)
	if err != nil {
		return nil, err
	}
	maxRows = clampMaxRows(maxRows)
	start := time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), defaultQueryTimeout)
	defer cancel()

	rows, err := db.QueryContext(ctx, sql)
	if err != nil {
		return resultWithError(err, start)
	}
	defer rows.Close()

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return resultWithError(err, start)
	}
	columns := make([]models.ColumnInfo, len(colTypes))
	for i, ct := range colTypes {
		columns[i].Name = ct.Name()
		columns[i].Type = ct.DatabaseTypeName()
		if l, ok := ct.Length(); ok {
			columns[i].Length = l
		}
		if n, ok := ct.Nullable(); ok {
			columns[i].Nullable = n
		}
	}

	var out [][]interface{}
	hasMore := false
	for rows.Next() {
		if len(out) >= maxRows {
			hasMore = true
			break
		}
		raw := make([]interface{}, len(columns))
		ptrs := make([]interface{}, len(columns))
		for i := range raw {
			ptrs[i] = &raw[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return resultWithError(err, start)
		}
		row := make([]interface{}, len(raw))
		for i, v := range raw {
			row[i] = normalizeCell(v)
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		return resultWithError(err, start)
	}

	elapsed := time.Since(start).Milliseconds()
	msg := fmt.Sprintf("%d row(s) returned.", len(out))
	if hasMore {
		msg += fmt.Sprintf(" (limit %d; more rows exist)", maxRows)
	}
	return &models.QueryResult{
		Columns:  columns,
		Rows:     out,
		RowCount: int64(len(out)),
		ExecTime: elapsed,
		Messages: []string{msg},
		HasMore:  hasMore,
	}, nil
}

// ExecuteDML runs INSERT/UPDATE/DELETE/MERGE/DDL/etc. via Exec. Does not auto-commit;
// transaction scope follows the pool default (autocommit per statement unless a txn is started later).
func (e *QueryExecutor) ExecuteDML(connID, sql string) (*models.QueryResult, error) {
	db, err := e.resolveDB(connID)
	if err != nil {
		return nil, err
	}
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), defaultQueryTimeout)
	defer cancel()

	res, err := db.ExecContext(ctx, sql)
	if err != nil {
		return resultWithError(err, start)
	}
	affected, _ := res.RowsAffected()
	elapsed := time.Since(start).Milliseconds()
	return &models.QueryResult{
		Columns:  nil,
		Rows:     nil,
		RowCount: affected,
		ExecTime: elapsed,
		Messages: []string{fmt.Sprintf("%d row(s) affected.", affected)},
		HasMore:  false,
	}, nil
}

// Commit runs a session COMMIT on the pool (same limitations as unpooled transactions with sql.DB).
func (e *QueryExecutor) Commit(connID string) error {
	db, err := e.resolveDB(connID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), defaultQueryTimeout)
	defer cancel()
	_, err = db.ExecContext(ctx, "COMMIT")
	return err
}

// Rollback runs a session ROLLBACK on the pool.
func (e *QueryExecutor) Rollback(connID string) error {
	db, err := e.resolveDB(connID)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), defaultQueryTimeout)
	defer cancel()
	_, err = db.ExecContext(ctx, "ROLLBACK")
	return err
}

// Execute picks query vs DML from ClassifyStatement. PL/SQL blocks are rejected until Phase 2.
func (e *QueryExecutor) Execute(connID, sql string, maxRows int) (*models.QueryResult, error) {
	switch ClassifyStatement(sql) {
	case KindUnknown:
		return nil, errors.New("empty SQL")
	case KindQuery:
		return e.ExecuteQuery(connID, sql, maxRows)
	case KindDML:
		return e.ExecuteDML(connID, sql)
	case KindPLSQL:
		return nil, fmt.Errorf("PL/SQL block: not supported in Phase 1 (use Phase 2 executor)")
	default:
		return nil, errors.New("unsupported statement")
	}
}

func resultWithError(err error, start time.Time) (*models.QueryResult, error) {
	if err == nil {
		return nil, nil
	}
	elapsed := time.Since(start).Milliseconds()
	msg := err.Error()
	// Oracle ORA-xxxxx appears in msg; UIs can show Messages even when err != nil.
	return &models.QueryResult{
		RowCount: 0,
		ExecTime: elapsed,
		Messages: []string{msg},
	}, err
}

func normalizeCell(v interface{}) interface{} {
	if v == nil {
		return nil
	}
	switch x := v.(type) {
	case []byte:
		return bytesToJSON(x)
	case string:
		return x
	case time.Time:
		return x.Format(time.RFC3339Nano)
	case godror.Number:
		return string(x)
	case int64, int32, int, float64, float32, bool:
		return x
	default:
		return fmt.Sprint(x)
	}
}

func bytesToJSON(b []byte) interface{} {
	if len(b) == 0 {
		return ""
	}
	if utf8.Valid(b) {
		return string(b)
	}
	return base64.StdEncoding.EncodeToString(b)
}
