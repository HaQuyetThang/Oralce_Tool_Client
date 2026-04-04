import type { QueryResult } from "../types";

/** True when the result should be shown in the grid (SELECT-style with column metadata). */
export function hasResultGrid(result: QueryResult | null | undefined): boolean {
  return Boolean(result?.columns && result.columns.length > 0);
}

/** After execute: open Results for SELECT, Messages for DML / errors / empty grid. */
export function pickResultSubTab(result: QueryResult): "results" | "messages" {
  return hasResultGrid(result) ? "results" : "messages";
}
