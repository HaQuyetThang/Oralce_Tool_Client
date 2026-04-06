package main

import (
	"context"
	"fmt"
	"strings"

	"oracle_client_soft/internal/config"
	"oracle_client_soft/internal/database"
	"oracle_client_soft/internal/models"
)

// App is the Wails binding surface: connection profiles, pools, SQL execution.
type App struct {
	ctx      context.Context
	connMgr  *database.ConnectionManager
	executor *database.QueryExecutor
	schema   *database.SchemaService
}

// NewApp wires database services used by the UI.
func NewApp() *App {
	mgr := database.NewConnectionManager()
	return &App{
		connMgr:  mgr,
		executor: database.NewQueryExecutor(mgr),
		schema:   database.NewSchemaService(mgr),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) shutdown(ctx context.Context) {
	a.connMgr.CloseAll()
}

// SaveConnection creates or updates a saved profile (see models.ConnectionConfig.Validate).
// Returns the persisted config (including generated id for new profiles).
func (a *App) SaveConnection(cfg models.ConnectionConfig) (models.ConnectionConfig, error) {
	return config.AddConnection(cfg)
}

// GetSavedConnections loads all profiles from disk.
func (a *App) GetSavedConnections() ([]models.ConnectionConfig, error) {
	return config.LoadConnections()
}

// DeleteConnection removes a profile and closes an open pool for that id if any.
func (a *App) DeleteConnection(id string) error {
	if err := config.DeleteConnection(id); err != nil {
		return err
	}
	return a.connMgr.Disconnect(id)
}

// Connect opens a pool for a saved profile id and makes it active.
func (a *App) Connect(id string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("connection id is required")
	}
	list, err := config.LoadConnections()
	if err != nil {
		return err
	}
	for i := range list {
		if list[i].ID == id {
			return a.connMgr.Connect(list[i])
		}
	}
	return fmt.Errorf("unknown connection id: %s", id)
}

// Disconnect closes the pool for id (no-op if not open).
func (a *App) Disconnect(id string) error {
	return a.connMgr.Disconnect(id)
}

// TestConnection checks host/credentials and returns a v$version banner (or a fallback message).
func (a *App) TestConnection(cfg models.ConnectionConfig) (string, error) {
	return a.connMgr.TestConnection(cfg)
}

// ExecuteSQL runs SQL with automatic query vs DML / PL-SQL routing (see database.ClassifyStatement).
// connID may be empty to use the active connection.
func (a *App) ExecuteSQL(connID, sql string, maxRows int) (*models.QueryResult, error) {
	return a.executor.Execute(connID, sql, maxRows)
}

// CancelQuery requests cancellation of the in-flight operation on a connection (connID empty = active).
func (a *App) CancelQuery(connID string) error {
	return a.executor.CancelQuery(connID)
}

// GetSchemas returns schema names visible via ALL_USERS.
func (a *App) GetSchemas(connID string) ([]string, error) {
	return a.schema.GetSchemas(connID)
}

// GetTables lists tables in a schema.
func (a *App) GetTables(connID, schema string) ([]models.TableInfo, error) {
	return a.schema.GetTables(connID, schema)
}

// GetViews lists views in a schema.
func (a *App) GetViews(connID, schema string) ([]string, error) {
	return a.schema.GetViews(connID, schema)
}

// GetMaterializedViews lists materialized views in a schema.
func (a *App) GetMaterializedViews(connID, schema string) ([]string, error) {
	return a.schema.GetMaterializedViews(connID, schema)
}

// GetColumns returns columns for a table.
func (a *App) GetColumns(connID, schema, table string) ([]models.ColumnDetail, error) {
	return a.schema.GetColumns(connID, schema, table)
}

// GetIndexes returns indexes for a table.
func (a *App) GetIndexes(connID, schema, table string) ([]models.IndexInfo, error) {
	return a.schema.GetIndexes(connID, schema, table)
}

// GetConstraints returns constraints for a table.
func (a *App) GetConstraints(connID, schema, table string) ([]models.ConstraintInfo, error) {
	return a.schema.GetConstraints(connID, schema, table)
}

// GetProcedures lists procedures in a schema.
func (a *App) GetProcedures(connID, schema string) ([]string, error) {
	return a.schema.GetProcedures(connID, schema)
}

// GetFunctions lists functions in a schema.
func (a *App) GetFunctions(connID, schema string) ([]string, error) {
	return a.schema.GetFunctions(connID, schema)
}

// GetPackages lists packages in a schema.
func (a *App) GetPackages(connID, schema string) ([]string, error) {
	return a.schema.GetPackages(connID, schema)
}

// GetSequences lists sequences in a schema.
func (a *App) GetSequences(connID, schema string) ([]string, error) {
	return a.schema.GetSequences(connID, schema)
}

// GetTriggersForSchema lists triggers in a schema.
func (a *App) GetTriggersForSchema(connID, schema string) ([]string, error) {
	return a.schema.GetTriggersForSchema(connID, schema)
}

// GetTriggersForTable lists triggers on a table.
func (a *App) GetTriggersForTable(connID, schema, table string) ([]string, error) {
	return a.schema.GetTriggersForTable(connID, schema, table)
}

// GetSynonyms lists synonyms in a schema.
func (a *App) GetSynonyms(connID, schema string) ([]string, error) {
	return a.schema.GetSynonyms(connID, schema)
}

// GetTypes lists object types in a schema.
func (a *App) GetTypes(connID, schema string) ([]string, error) {
	return a.schema.GetTypes(connID, schema)
}

// GetDDL returns metadata DDL for an object (objectType e.g. TABLE, VIEW).
func (a *App) GetDDL(connID, schema, objectType, objectName string) (string, error) {
	return a.schema.GetDDL(connID, schema, objectType, objectName)
}

// Commit sends COMMIT to Oracle for the given profile pool (connID empty = active).
func (a *App) Commit(connID string) error {
	return a.executor.Commit(connID)
}

// Rollback sends ROLLBACK to Oracle for the given profile pool (connID empty = active).
func (a *App) Rollback(connID string) error {
	return a.executor.Rollback(connID)
}

// GetActiveConnectionID returns the last connected profile id, or "" if none.
func (a *App) GetActiveConnectionID() string {
	return a.connMgr.ActiveConnectionID()
}
