import * as monaco from "monaco-editor";
import { GetColumns } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";
import { useSchemaStore } from "../stores/schemaStore";
import { columnsCacheKey } from "./sqlCompletionKeys";
import { getDefaultSchemaForConnection } from "./sqlCompletionSchema";

const Kind = monaco.languages.CompletionItemKind;

export type TableRef = { schema: string; table: string };

/** `schema.table` / `alias` / `table` before the final `.` (MVP: unquoted identifiers). */
function extractDotQualifier(prefix: string): string | null {
  const s = prefix.replace(/\s+$/, "");
  const re =
    /((?:[A-Za-z_][\w$#]*)(?:\.[A-Za-z_][\w$#]*)*)\.([A-Za-z_][\w$#]*)?$/;
  const m = s.match(re);
  if (!m) {
    return null;
  }
  return m[1] ?? null;
}

function linePrefixBeforeCursor(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): string {
  const line = model.getLineContent(position.lineNumber);
  return line.slice(0, Math.max(0, position.column - 1));
}

/** Statement-ish chunk before cursor (avoid scanning huge scripts; skip prior statements after `;`). */
export function sqlChunkBeforeCursor(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): string {
  const offset = model.getOffsetAt(position);
  const full = model.getValue();
  const maxLen = 16000;
  const start = Math.max(0, offset - maxLen);
  let slice = full.slice(start, offset);
  const semiRel = slice.lastIndexOf(";");
  if (semiRel >= 0) {
    slice = slice.slice(semiRel + 1);
  }
  return slice;
}

function extractFromClause(sql: string): string {
  const fm = /\bFROM\b/i.exec(sql);
  if (!fm) {
    return "";
  }
  const rest = sql.slice(fm.index + fm[0].length);
  const stop = /\b(WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|CONNECT\s+BY|START\s+WITH|MINUS|UNION(\s+ALL)?|INTERSECT|FETCH\b|OFFSET\b|FOR\s+UPDATE)\b/i.exec(
    rest
  );
  return stop ? rest.slice(0, stop.index) : rest;
}

function splitFromList(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") {
      depth++;
    }
    if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }
    if (ch === "," && depth === 0) {
      const t = cur.trim();
      if (t) {
        parts.push(t);
      }
      cur = "";
    } else {
      cur += ch;
    }
  }
  const last = cur.trim();
  if (last) {
    parts.push(last);
  }
  return parts;
}

function stripJoinLeading(sql: string): string {
  let t = sql.trim();
  while (
    /^(?:(?:INNER|LEFT|RIGHT|FULL|CROSS|NATURAL)\s+)*(?:OUTER\s+)?JOIN\s+/i.test(
      t
    )
  ) {
    t = t
      .replace(
        /^(?:(?:INNER|LEFT|RIGHT|FULL|CROSS|NATURAL)\s+)*(?:OUTER\s+)?JOIN\s+/i,
        ""
      )
      .trim();
  }
  return t;
}

function parseTableEntry(
  raw: string,
  defaultSchema: string
): { refs: TableRef[]; aliases: string[] } | null {
  let t = stripJoinLeading(raw.trim());
  t = t.replace(/\bAS\s+/i, " ").trim();
  const onIdx = t.search(/\s+ON\b/i);
  if (onIdx >= 0) {
    t = t.slice(0, onIdx).trim();
  }
  const usingIdx = t.search(/\s+USING\s*\(/i);
  if (usingIdx >= 0) {
    t = t.slice(0, usingIdx).trim();
  }
  if (!t) {
    return null;
  }

  const tokens = t.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const first = tokens[0]!;
  let schema = defaultSchema;
  let table = first;
  if (first.includes(".")) {
    const segs = first.split(".");
    if (segs.length >= 2) {
      schema = segs[0]!;
      table = segs.slice(1).join(".");
    }
  }

  const ref: TableRef = { schema, table };
  const aliases = new Set<string>();
  const upperTable = table.toUpperCase();
  aliases.add(upperTable);

  if (tokens.length >= 2) {
    const maybeAlias = tokens[tokens.length - 1]!;
    if (!/^(ON|AND|OR|USING)$/i.test(maybeAlias)) {
      aliases.add(maybeAlias.toUpperCase());
    }
  }

  return {
    refs: [ref],
    aliases: [...aliases],
  };
}

/** Map unquoted alias/table token (uppercase keys) → table ref. MVP: single FROM; JOIN list; no subquery merge. */
export function buildAliasMap(
  sqlFragment: string,
  defaultSchema: string
): Map<string, TableRef> {
  const map = new Map<string, TableRef>();
  const fromClause = extractFromClause(sqlFragment);
  if (!fromClause.trim()) {
    return map;
  }

  const parts = splitFromList(fromClause);
  for (const part of parts) {
    const parsed = parseTableEntry(part, defaultSchema);
    if (!parsed) {
      continue;
    }
    const ref = parsed.refs[0]!;
    for (const a of parsed.aliases) {
      if (!map.has(a)) {
        map.set(a, ref);
      }
    }
  }
  return map;
}

function resolveQualifierToTableRef(
  qualifier: string,
  aliasMap: Map<string, TableRef>,
  defaultSchema: string
): TableRef | null {
  const q = qualifier.trim();
  if (!q) {
    return null;
  }
  if (q.includes(".")) {
    const segs = q.split(".");
    if (segs.length >= 2) {
      return { schema: segs[0]!, table: segs[1]! };
    }
  }
  const key = q.toUpperCase();
  const hit = aliasMap.get(key);
  if (hit) {
    return hit;
  }
  return { schema: defaultSchema, table: q };
}

function columnDetail(c: models.ColumnDetail): string {
  const parts: string[] = [c.dataType];
  if (c.dataLength > 0) {
    parts.push(`(${c.dataLength})`);
  } else if (c.dataPrecision != null && c.dataPrecision > 0) {
    const prec = c.dataPrecision;
    const sc = c.dataScale;
    parts.push(
      sc != null && sc > 0 ? `(${prec},${sc})` : `(${prec})`
    );
  }
  parts.push(c.nullable ? "NULL" : "NOT NULL");
  return parts.join(" · ");
}

/**
 * Dot-completion (`x.` or `x.col`): columns for resolved table/view.
 * @returns `null` — not a dot context; `[]` — resolved but no columns / error; otherwise column items.
 */
export async function getSqlDotColumnCompletionItems(
  connId: string,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  range: monaco.Range,
  token: monaco.CancellationToken,
  _: monaco.languages.CompletionContext
): Promise<monaco.languages.CompletionItem[] | null> {
  const linePrefix = linePrefixBeforeCursor(model, position);
  const qualifier = extractDotQualifier(linePrefix);
  if (!qualifier) {
    return null;
  }

  const { defaultSchema } = await getDefaultSchemaForConnection(connId);
  if (token.isCancellationRequested) {
    return null;
  }
  if (!defaultSchema) {
    return [];
  }

  const chunk = sqlChunkBeforeCursor(model, position);
  const aliasMap = buildAliasMap(chunk, defaultSchema);
  const ref = resolveQualifierToTableRef(qualifier, aliasMap, defaultSchema);
  if (!ref || !ref.table) {
    return [];
  }

  const { fetch } = useSchemaStore.getState();
  const colKey = columnsCacheKey(connId, ref.schema, ref.table);

  let columns: models.ColumnDetail[];
  try {
    columns = (await fetch(colKey, () =>
      GetColumns(connId, ref.schema, ref.table)
    )) as models.ColumnDetail[];
  } catch (e) {
    console.warn("[sql-completion-dot] GetColumns", e);
    return [];
  }

  if (token.isCancellationRequested) {
    return null;
  }

  const out: monaco.languages.CompletionItem[] = [];
  for (const c of columns ?? []) {
    if (!c.name) {
      continue;
    }
    out.push({
      label: c.name,
      kind: Kind.Field,
      detail: columnDetail(c),
      insertText: `${c.name} `,
      sortText: `0_col_${c.name}`,
      range,
    });
  }
  return out;
}
