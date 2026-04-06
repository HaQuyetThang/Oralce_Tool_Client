import type { QueryResult } from "../types";

/** True when the result should be shown in the grid (SELECT-style with column metadata). */
export function hasResultGrid(result: QueryResult | null | undefined): boolean {
  return Boolean(result?.columns && result.columns.length > 0);
}

function hasOraError(result: QueryResult): boolean {
  return Boolean(
    result.messages?.some((m) => /ORA-\d{5}/i.test(String(m)))
  );
}

/** After execute: Results / Messages / DBMS Output. */
export function pickResultSubTab(
  result: QueryResult
): "results" | "messages" | "dbms" {
  if (hasOraError(result)) {
    return "messages";
  }
  if (result.dbmsOutputLines && result.dbmsOutputLines.length > 0) {
    return "dbms";
  }
  return hasResultGrid(result) ? "results" : "messages";
}
