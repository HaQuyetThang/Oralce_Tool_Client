package models

import (
	"errors"
	"strings"
)

// ConnectionConfig describes a saved Oracle connection profile (JSON-serializable for Wails).
type ConnectionConfig struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	ServiceName string `json:"serviceName"`
	SID         string `json:"sid"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	Role        string `json:"role"` // e.g. SYSDBA, SYSOPER, or empty
}

// Validate checks required fields for connecting or saving.
func (c *ConnectionConfig) Validate() error {
	if strings.TrimSpace(c.Name) == "" {
		return errors.New("connection name is required")
	}
	if strings.TrimSpace(c.Host) == "" {
		return errors.New("host is required")
	}
	if c.Port <= 0 || c.Port > 65535 {
		return errors.New("port must be between 1 and 65535")
	}
	if strings.TrimSpace(c.Username) == "" {
		return errors.New("username is required")
	}
	if strings.TrimSpace(c.ServiceName) == "" && strings.TrimSpace(c.SID) == "" {
		return errors.New("either serviceName or sid is required")
	}
	return nil
}

// ValidateForConnect checks fields required to open an Oracle session (name not required).
func (c *ConnectionConfig) ValidateForConnect() error {
	if strings.TrimSpace(c.Host) == "" {
		return errors.New("host is required")
	}
	if c.Port <= 0 || c.Port > 65535 {
		return errors.New("port must be between 1 and 65535")
	}
	if strings.TrimSpace(c.Username) == "" {
		return errors.New("username is required")
	}
	if strings.TrimSpace(c.ServiceName) == "" && strings.TrimSpace(c.SID) == "" {
		return errors.New("either serviceName or sid is required")
	}
	return nil
}
