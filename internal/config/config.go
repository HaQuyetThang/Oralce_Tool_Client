// Package config persists app data (saved connections). Passwords are stored in
// plaintext in JSON for Phase 1; replace with encryption before production (see plan Phase 4).
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"oracle_client_soft/internal/models"

	"github.com/google/uuid"
)

const appDirName = "OracleSQLLite"
const connectionsFile = "connections.json"

// connectionsFilePayload is the on-disk JSON shape.
type connectionsFilePayload struct {
	Connections []models.ConnectionConfig `json:"connections"`
}

var (
	mu sync.RWMutex
)

// DataDir returns %APPDATA%/OracleSQLLite on Windows (UserConfigDir + app name).
func DataDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("user config dir: %w", err)
	}
	return filepath.Join(base, appDirName), nil
}

// ConnectionsPath is the full path to connections.json.
func ConnectionsPath() (string, error) {
	dir, err := DataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, connectionsFile), nil
}

// ensureDataDir creates the app data directory if missing.
func ensureDataDir() error {
	dir, err := DataDir()
	if err != nil {
		return err
	}
	return os.MkdirAll(dir, 0o700)
}

// LoadConnections reads saved connections from disk.
// Returns an empty slice if the file does not exist yet.
func LoadConnections() ([]models.ConnectionConfig, error) {
	mu.Lock()
	defer mu.Unlock()

	path, err := ConnectionsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []models.ConnectionConfig{}, nil
		}
		return nil, fmt.Errorf("read connections: %w", err)
	}
	var p connectionsFilePayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse connections: %w", err)
	}
	if p.Connections == nil {
		return []models.ConnectionConfig{}, nil
	}
	return p.Connections, nil
}

// SaveConnections writes the full list to disk (replaces file contents).
func SaveConnections(list []models.ConnectionConfig) error {
	mu.Lock()
	defer mu.Unlock()

	if err := ensureDataDir(); err != nil {
		return err
	}
	path, err := ConnectionsPath()
	if err != nil {
		return err
	}
	p := connectionsFilePayload{Connections: list}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("encode connections: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write temp connections: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename connections file: %w", err)
	}
	return nil
}

// AddConnection appends a connection or updates an existing one by ID.
// If cfg.ID is empty, a new UUID is assigned.
func AddConnection(cfg models.ConnectionConfig) (models.ConnectionConfig, error) {
	mu.Lock()
	defer mu.Unlock()

	if err := cfg.Validate(); err != nil {
		return models.ConnectionConfig{}, err
	}
	list, err := loadConnectionsUnlocked()
	if err != nil {
		return models.ConnectionConfig{}, err
	}
	if cfg.ID == "" {
		cfg.ID = uuid.NewString()
	} else {
		for i := range list {
			if list[i].ID == cfg.ID {
				list[i] = cfg
				if err := saveConnectionsUnlocked(list); err != nil {
					return models.ConnectionConfig{}, err
				}
				return cfg, nil
			}
		}
	}
	list = append(list, cfg)
	if err := saveConnectionsUnlocked(list); err != nil {
		return models.ConnectionConfig{}, err
	}
	return cfg, nil
}

// DeleteConnection removes a connection by id. No error if id is missing.
func DeleteConnection(id string) error {
	mu.Lock()
	defer mu.Unlock()

	if id == "" {
		return errors.New("connection id is required")
	}
	list, err := loadConnectionsUnlocked()
	if err != nil {
		return err
	}
	out := list[:0]
	for _, c := range list {
		if c.ID != id {
			out = append(out, c)
		}
	}
	if len(out) == len(list) {
		return nil
	}
	return saveConnectionsUnlocked(out)
}

// loadConnectionsUnlocked reads file without taking mu (caller must hold mu).
func loadConnectionsUnlocked() ([]models.ConnectionConfig, error) {
	path, err := ConnectionsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []models.ConnectionConfig{}, nil
		}
		return nil, fmt.Errorf("read connections: %w", err)
	}
	var p connectionsFilePayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse connections: %w", err)
	}
	if p.Connections == nil {
		return []models.ConnectionConfig{}, nil
	}
	return p.Connections, nil
}

func saveConnectionsUnlocked(list []models.ConnectionConfig) error {
	if err := ensureDataDir(); err != nil {
		return err
	}
	path, err := ConnectionsPath()
	if err != nil {
		return err
	}
	p := connectionsFilePayload{Connections: list}
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return fmt.Errorf("encode connections: %w", err)
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write temp connections: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("rename connections file: %w", err)
	}
	return nil
}
