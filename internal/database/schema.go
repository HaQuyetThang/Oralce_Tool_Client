package database

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"oracle_client_soft/internal/models"
)

const schemaQueryTimeout = 60 * time.Second

// SchemaService loads Oracle data dictionary metadata for the schema browser.
type SchemaService struct {
	mgr *ConnectionManager
}

// NewSchemaService constructs a service bound to mgr.
func NewSchemaService(mgr *ConnectionManager) *SchemaService {
	if mgr == nil {
		panic("database: NewSchemaService(nil)")
	}
	return &SchemaService{mgr: mgr}
}

func (s *SchemaService) dbCtx(connID string) (*sql.DB, context.Context, context.CancelFunc, error) {
	db, _, err := s.mgr.ResolveDB(connID)
	if err != nil {
		return nil, nil, nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), schemaQueryTimeout)
	return db, ctx, cancel, nil
}

func normSchema(schema string) (string, error) {
	o := strings.TrimSpace(schema)
	if o == "" {
		return "", errors.New("schema name is required")
	}
	return strings.ToUpper(o), nil
}

// GetSchemas returns usernames visible via ALL_USERS.
func (s *SchemaService) GetSchemas(connID string) ([]string, error) {
	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `SELECT username FROM all_users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}

// GetTables lists tables in a schema (ALL_TABLES).
func (s *SchemaService) GetTables(connID, schema string) ([]models.TableInfo, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx,
		`SELECT table_name, num_rows FROM all_tables WHERE owner = :1 ORDER BY table_name`,
		owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.TableInfo
	for rows.Next() {
		var t models.TableInfo
		var nr sql.NullInt64
		if err := rows.Scan(&t.Name, &nr); err != nil {
			return nil, err
		}
		if nr.Valid {
			v := nr.Int64
			t.NumRows = &v
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// GetViews lists view names in a schema.
func (s *SchemaService) GetViews(connID, schema string) ([]string, error) {
	return s.queryNames(connID, schema,
		`SELECT view_name FROM all_views WHERE owner = :1 ORDER BY view_name`)
}

// GetMaterializedViews lists materialized view names in a schema.
func (s *SchemaService) GetMaterializedViews(connID, schema string) ([]string, error) {
	return s.queryNames(connID, schema,
		`SELECT mview_name FROM all_mviews WHERE owner = :1 ORDER BY mview_name`)
}

// GetColumns returns column metadata for a table.
func (s *SchemaService) GetColumns(connID, schema, table string) ([]models.ColumnDetail, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	tbl := strings.TrimSpace(table)
	if tbl == "" {
		return nil, errors.New("table name is required")
	}
	tbl = strings.ToUpper(tbl)

	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `
SELECT column_name, data_type, data_length, data_precision, data_scale, nullable, column_id
FROM all_tab_columns
WHERE owner = :1 AND table_name = :2
ORDER BY column_id`, owner, tbl)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ColumnDetail
	for rows.Next() {
		var c models.ColumnDetail
		var prec, scale sql.NullInt64
		var nullFlag string
		if err := rows.Scan(&c.Name, &c.DataType, &c.DataLength, &prec, &scale, &nullFlag, &c.ColumnID); err != nil {
			return nil, err
		}
		if prec.Valid {
			v := prec.Int64
			c.DataPrecision = &v
		}
		if scale.Valid {
			v := scale.Int64
			c.DataScale = &v
		}
		c.Nullable = strings.EqualFold(nullFlag, "Y")
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetIndexes lists indexes on a table.
func (s *SchemaService) GetIndexes(connID, schema, table string) ([]models.IndexInfo, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	tbl := strings.TrimSpace(table)
	if tbl == "" {
		return nil, errors.New("table name is required")
	}
	tbl = strings.ToUpper(tbl)

	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `
SELECT index_name, uniqueness
FROM all_indexes
WHERE owner = :1 AND table_name = :2
ORDER BY index_name`, owner, tbl)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.IndexInfo
	for rows.Next() {
		var i models.IndexInfo
		if err := rows.Scan(&i.Name, &i.Uniqueness); err != nil {
			return nil, err
		}
		out = append(out, i)
	}
	return out, rows.Err()
}

// GetConstraints lists constraints on a table.
func (s *SchemaService) GetConstraints(connID, schema, table string) ([]models.ConstraintInfo, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	tbl := strings.TrimSpace(table)
	if tbl == "" {
		return nil, errors.New("table name is required")
	}
	tbl = strings.ToUpper(tbl)

	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `
SELECT constraint_name, constraint_type
FROM all_constraints
WHERE owner = :1 AND table_name = :2
ORDER BY constraint_name`, owner, tbl)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.ConstraintInfo
	for rows.Next() {
		var c models.ConstraintInfo
		if err := rows.Scan(&c.Name, &c.ConstraintType); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetProcedures lists standalone procedure object names.
func (s *SchemaService) GetProcedures(connID, schema string) ([]string, error) {
	return s.queryObjectNames(connID, schema, "PROCEDURE")
}

// GetFunctions lists standalone function object names.
func (s *SchemaService) GetFunctions(connID, schema string) ([]string, error) {
	return s.queryObjectNames(connID, schema, "FUNCTION")
}

// GetPackages lists package names (spec).
func (s *SchemaService) GetPackages(connID, schema string) ([]string, error) {
	return s.queryObjectNames(connID, schema, "PACKAGE")
}

// GetSequences lists sequence names.
func (s *SchemaService) GetSequences(connID, schema string) ([]string, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx,
		`SELECT sequence_name FROM all_sequences WHERE sequence_owner = :1 ORDER BY sequence_name`, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringColumn(rows)
}

// GetTriggersForSchema lists trigger names in a schema (all triggers the user can see).
func (s *SchemaService) GetTriggersForSchema(connID, schema string) ([]string, error) {
	return s.queryNames(connID, schema,
		`SELECT trigger_name FROM all_triggers WHERE owner = :1 ORDER BY trigger_name`)
}

// GetTriggersForTable lists triggers defined on a specific table.
func (s *SchemaService) GetTriggersForTable(connID, schema, table string) ([]string, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	tbl := strings.TrimSpace(table)
	if tbl == "" {
		return nil, errors.New("table name is required")
	}
	tbl = strings.ToUpper(tbl)

	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `
SELECT trigger_name FROM all_triggers
WHERE owner = :1 AND table_name = :2
ORDER BY trigger_name`, owner, tbl)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringColumn(rows)
}

// GetSynonyms lists synonyms owned by the schema.
func (s *SchemaService) GetSynonyms(connID, schema string) ([]string, error) {
	return s.queryNames(connID, schema,
		`SELECT synonym_name FROM all_synonyms WHERE owner = :1 ORDER BY synonym_name`)
}

// GetTypes lists object types in a schema.
func (s *SchemaService) GetTypes(connID, schema string) ([]string, error) {
	return s.queryNames(connID, schema,
		`SELECT type_name FROM all_types WHERE owner = :1 ORDER BY type_name`)
}

// GetDDL returns DDL from DBMS_METADATA.GET_DDL (objectType e.g. TABLE, VIEW, PROCEDURE).
func (s *SchemaService) GetDDL(connID, schema, objectType, objectName string) (string, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return "", err
	}
	ot := strings.TrimSpace(strings.ToUpper(objectType))
	on := strings.TrimSpace(strings.ToUpper(objectName))
	if ot == "" || on == "" {
		return "", errors.New("object type and name are required")
	}

	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return "", err
	}
	defer cancel()

	var clob sql.NullString
	err = db.QueryRowContext(ctx,
		`SELECT DBMS_METADATA.GET_DDL(:1, :2, :3) FROM dual`,
		ot, on, owner,
	).Scan(&clob)
	if err != nil {
		return "", err
	}
	if !clob.Valid {
		return "", nil
	}
	return clob.String, nil
}

func (s *SchemaService) queryNames(connID, schema, q string) ([]string, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, q, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringColumn(rows)
}

func (s *SchemaService) queryObjectNames(connID, schema, objectType string) ([]string, error) {
	owner, err := normSchema(schema)
	if err != nil {
		return nil, err
	}
	db, ctx, cancel, err := s.dbCtx(connID)
	if err != nil {
		return nil, err
	}
	defer cancel()

	rows, err := db.QueryContext(ctx, `
SELECT object_name FROM all_objects
WHERE owner = :1 AND object_type = :2
ORDER BY object_name`, owner, objectType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanStringColumn(rows)
}

func scanStringColumn(rows *sql.Rows) ([]string, error) {
	var out []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}
