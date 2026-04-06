package models

// TableInfo is one table in a schema (data dictionary).
type TableInfo struct {
	Name    string `json:"name"`
	NumRows *int64 `json:"numRows,omitempty"`
}

// ColumnDetail is one column of a table (ALL_TAB_COLUMNS).
type ColumnDetail struct {
	Name          string `json:"name"`
	DataType      string `json:"dataType"`
	DataLength    int64  `json:"dataLength"`
	DataPrecision *int64 `json:"dataPrecision,omitempty"`
	DataScale     *int64 `json:"dataScale,omitempty"`
	Nullable      bool   `json:"nullable"`
	ColumnID      int    `json:"columnId"`
}

// IndexInfo is one index on a table (ALL_INDEXES).
type IndexInfo struct {
	Name       string `json:"name"`
	Uniqueness string `json:"uniqueness"`
}

// ConstraintInfo is one constraint on a table (ALL_CONSTRAINTS).
type ConstraintInfo struct {
	Name           string `json:"name"`
	ConstraintType string `json:"constraintType"`
}
