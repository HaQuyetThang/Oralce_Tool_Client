export type SqlCompletionSituation =
  | "from_join"
  | "select_list"
  | "where_expr"
  | "plsql"
  | "general";

const KW =
  /\b(SELECT|FROM|WHERE|AND|OR|JOIN|DECLARE|BEGIN|EXCEPTION|THEN|ELSIF|LOOP|GROUP\s+BY|ORDER\s+BY|HAVING)\b/gi;

const PL_TAIL = new Set([
  "DECLARE",
  "BEGIN",
  "EXCEPTION",
  "THEN",
  "ELSIF",
  "LOOP",
]);

/** Heuristic: last SQL/PL keyword in text before cursor (MVP — nested SQL/PL ignored). */
export function detectSqlCompletionSituation(chunk: string): SqlCompletionSituation {
  if (!chunk.trim()) {
    return "general";
  }
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  const re = new RegExp(KW.source, KW.flags);
  while ((m = re.exec(chunk)) !== null) {
    last = m;
  }
  if (!last) {
    return "general";
  }
  const kw = last[1]!.toUpperCase().replace(/\s+/g, " ");

  if (PL_TAIL.has(kw)) {
    return "plsql";
  }
  if (kw === "FROM" || kw === "JOIN") {
    return "from_join";
  }
  if (kw === "WHERE" || kw === "AND" || kw === "OR") {
    return "where_expr";
  }
  if (
    kw === "SELECT" ||
    kw === "GROUP BY" ||
    kw === "ORDER BY" ||
    kw === "HAVING"
  ) {
    return "select_list";
  }
  return "general";
}
