import { format } from "sql-formatter";

/** Oracle / PL-SQL–oriented formatting via sql-formatter `plsql` dialect. */
export function formatOracleSql(sql: string): string {
  const trimmed = sql.trim();
  if (!trimmed) {
    return sql;
  }
  return format(trimmed, {
    language: "plsql",
    tabWidth: 2,
    useTabs: false,
    keywordCase: "upper",
  });
}
