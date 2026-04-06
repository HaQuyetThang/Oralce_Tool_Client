/** Mirrors Go/Wails JSON for connection profiles and query results. */

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  serviceName: string;
  sid: string;
  username: string;
  password: string;
  role: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length: number;
  nullable: boolean;
}

export interface QueryResult {
  columns: ColumnInfo[] | null;
  rows: unknown[][] | null;
  rowCount: number;
  execTimeMs: number;
  messages: string[] | null;
  hasMore: boolean;
  dbmsOutputLines?: string[] | null;
}

export interface EditorTab {
  id: string;
  title: string;
  content: string;
  /** Saved connection profile id; empty = use global active connection. */
  connectionId?: string;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

/** Schema browser (mirrors Go models/schema.go). */
export interface TableInfo {
  name: string;
  numRows?: number;
}

export interface ColumnDetail {
  name: string;
  dataType: string;
  dataLength: number;
  dataPrecision?: number;
  dataScale?: number;
  nullable: boolean;
  columnId: number;
}

export interface IndexInfo {
  name: string;
  uniqueness: string;
}

export interface ConstraintInfo {
  name: string;
  constraintType: string;
}
