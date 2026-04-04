package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"oracle_client_soft/internal/config"
	"oracle_client_soft/internal/models"

	"github.com/godror/godror"
)

const (
	pingTimeout       = 15 * time.Second
	testPingTimeout   = 10 * time.Second
	maxOpenConns      = 5
	maxIdleConns      = 2
	connMaxLifetime   = 30 * time.Minute
	versionQuery      = `SELECT BANNER FROM v$version WHERE ROWNUM = 1`
	sanityQuery       = `SELECT 1 FROM dual`
	connectTimeoutSec = 15
)

// ConnectionManager holds open sql.DB pools keyed by connection profile ID.
type ConnectionManager struct {
	mu           sync.RWMutex
	connections  map[string]*sql.DB
	configs      map[string]models.ConnectionConfig
	activeConnID string
}

// NewConnectionManager creates an empty manager.
func NewConnectionManager() *ConnectionManager {
	return &ConnectionManager{
		connections: make(map[string]*sql.DB),
		configs:     make(map[string]models.ConnectionConfig),
	}
}

func buildConnectString(cfg models.ConnectionConfig) string {
	var target string
	if strings.TrimSpace(cfg.ServiceName) != "" {
		target = strings.TrimSpace(cfg.ServiceName)
	} else {
		target = strings.TrimSpace(cfg.SID)
	}
	// Easy Connect: host:port/service
	return fmt.Sprintf("%s:%d/%s?connect_timeout=%d", cfg.Host, cfg.Port, target, connectTimeoutSec)
}

func applyAdminRole(P *godror.ConnectionParams, role string) {
	r := strings.TrimSpace(strings.ToUpper(role))
	switch r {
	case "SYSDBA":
		P.AdminRole = godror.SysDBA
	case "SYSOPER":
		P.AdminRole = godror.SysOPER
	case "SYSBACKUP":
		P.AdminRole = godror.SysBACKUP
	case "SYSDG":
		P.AdminRole = godror.SysDG
	case "SYSKM":
		P.AdminRole = godror.SysKM
	case "SYSRAC":
		P.AdminRole = godror.SysRAC
	case "SYSASM":
		P.AdminRole = godror.SysASM
	default:
		// zero AdminRole = normal session
	}
}

func newDBFromConfig(cfg models.ConnectionConfig) (*sql.DB, error) {
	if err := cfg.ValidateForConnect(); err != nil {
		return nil, err
	}
	var P godror.ConnectionParams
	P.Username = cfg.Username
	P.Password = godror.NewPassword(cfg.Password)
	P.ConnectString = buildConnectString(cfg)
	applyAdminRole(&P, cfg.Role)

	db := sql.OpenDB(godror.NewConnector(P))
	db.SetMaxOpenConns(maxOpenConns)
	db.SetMaxIdleConns(maxIdleConns)
	db.SetConnMaxLifetime(connMaxLifetime)
	return db, nil
}

// Connect opens (or reopens) a pool for cfg.ID and sets it as the active connection.
func (m *ConnectionManager) Connect(cfg models.ConnectionConfig) error {
	if strings.TrimSpace(cfg.ID) == "" {
		return errors.New("connection id is required")
	}
	if err := cfg.ValidateForConnect(); err != nil {
		return err
	}
	db, err := newDBFromConfig(cfg)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), pingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return fmt.Errorf("ping: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if old, ok := m.connections[cfg.ID]; ok {
		_ = old.Close()
	}
	m.connections[cfg.ID] = db
	m.configs[cfg.ID] = cfg
	m.activeConnID = cfg.ID
	return nil
}

// Disconnect closes the pool for connID and clears active if it matched.
func (m *ConnectionManager) Disconnect(connID string) error {
	if connID == "" {
		return errors.New("connection id is required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	db, ok := m.connections[connID]
	if !ok {
		return nil
	}
	delete(m.connections, connID)
	delete(m.configs, connID)
	if m.activeConnID == connID {
		m.activeConnID = ""
	}
	return db.Close()
}

// TestConnection validates credentials and returns the first v$version banner line.
func (m *ConnectionManager) TestConnection(cfg models.ConnectionConfig) (string, error) {
	if err := cfg.ValidateForConnect(); err != nil {
		return "", err
	}
	db, err := newDBFromConfig(cfg)
	if err != nil {
		return "", err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), testPingTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return "", fmt.Errorf("ping: %w", err)
	}

	ctx2, cancel2 := context.WithTimeout(context.Background(), testPingTimeout)
	defer cancel2()
	var banner string
	err = db.QueryRowContext(ctx2, versionQuery).Scan(&banner)
	if err != nil {
		// v$version may be unavailable for some users; still report success.
		ctx3, cancel3 := context.WithTimeout(context.Background(), testPingTimeout)
		defer cancel3()
		if err2 := db.QueryRowContext(ctx3, sanityQuery).Scan(new(int)); err2 != nil {
			return "", fmt.Errorf("version query: %w", err)
		}
		return "Connected (version query not permitted)", nil
	}
	return strings.TrimSpace(banner), nil
}

// GetActiveConnection returns the sql.DB for the active connection, or nil if none.
func (m *ConnectionManager) GetActiveConnection() *sql.DB {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.activeConnID == "" {
		return nil
	}
	return m.connections[m.activeConnID]
}

// ActiveConnectionID returns the id of the active pool, or empty string.
func (m *ConnectionManager) ActiveConnectionID() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.activeConnID
}

// SetActiveConnection marks connID as active; connID must already be connected.
func (m *ConnectionManager) SetActiveConnection(connID string) error {
	if connID == "" {
		return errors.New("connection id is required")
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.connections[connID]; !ok {
		return fmt.Errorf("not connected: %s", connID)
	}
	m.activeConnID = connID
	return nil
}

// ListConnections returns saved connection profiles from disk (not only open pools).
func (m *ConnectionManager) ListConnections() ([]models.ConnectionConfig, error) {
	_ = m // reserved for future merge with runtime state
	return config.LoadConnections()
}

// ConnectionByID returns an open pool by id, or nil.
func (m *ConnectionManager) ConnectionByID(connID string) *sql.DB {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connections[connID]
}

// ConnectedIDs returns ids of all open pools.
func (m *ConnectionManager) ConnectedIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]string, 0, len(m.connections))
	for id := range m.connections {
		out = append(out, id)
	}
	return out
}

// CloseAll closes every pool (e.g. on app shutdown).
func (m *ConnectionManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, db := range m.connections {
		_ = db.Close()
		delete(m.connections, id)
		delete(m.configs, id)
	}
	m.activeConnID = ""
}
