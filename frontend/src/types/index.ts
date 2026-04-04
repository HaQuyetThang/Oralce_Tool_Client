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
}

export interface EditorTab {
  id: string;
  title: string;
  content: string;
  /** Saved connection profile id; empty = use global active connection. */
  connectionId?: string;
}

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
