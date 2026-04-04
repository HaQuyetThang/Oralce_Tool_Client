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
}

// NewApp wires database services used by the UI.
func NewApp() *App {
	mgr := database.NewConnectionManager()
	return &App{
		connMgr:  mgr,
		executor: database.NewQueryExecutor(mgr),
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

// ExecuteSQL runs SQL with automatic query vs DML routing (see database.ClassifyStatement).
// connID may be empty to use the active connection.
func (a *App) ExecuteSQL(connID, sql string, maxRows int) (*models.QueryResult, error) {
	return a.executor.Execute(connID, sql, maxRows)
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
