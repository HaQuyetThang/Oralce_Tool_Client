package models

// QueryResult is returned after running SQL in the editor (Wails JSON binding).
type QueryResult struct {
	Columns         []ColumnInfo    `json:"columns"`
	Rows            [][]interface{} `json:"rows"`
	RowCount        int64           `json:"rowCount"`
	ExecTime        int64           `json:"execTimeMs"` // milliseconds
	Messages        []string        `json:"messages"`
	HasMore         bool            `json:"hasMore"` // reserved for pagination (Phase 2+)
	DbmsOutputLines []string        `json:"dbmsOutputLines,omitempty"`
}

// ColumnInfo describes one column in a result set.
type ColumnInfo struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Length   int64  `json:"length"`
	Nullable bool   `json:"nullable"`
}
