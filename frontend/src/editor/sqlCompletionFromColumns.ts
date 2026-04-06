import * as monaco from "monaco-editor";
import { GetColumns } from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";
import { useSchemaStore } from "../stores/schemaStore";
import { buildAliasMap, sqlChunkBeforeCursor } from "./sqlCompletionDot";
import { columnsCacheKey } from "./sqlCompletionKeys";
import { getDefaultSchemaForConnection } from "./sqlCompletionSchema";

const Kind = monaco.languages.CompletionItemKind;
const MAX_TABLES = 12;

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
 * Columns for all tables/views resolved in the current statement’s FROM clause (cached per table).
 */
export async function getColumnsFromFromClauseCompletionItems(
  connId: string,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  range: monaco.Range,
  token: monaco.CancellationToken
): Promise<monaco.languages.CompletionItem[]> {
  const { defaultSchema } = await getDefaultSchemaForConnection(connId);
  if (!defaultSchema || token.isCancellationRequested) {
    return [];
  }

  const chunk = sqlChunkBeforeCursor(model, position);
  const aliasMap = buildAliasMap(chunk, defaultSchema);
  if (aliasMap.size === 0) {
    return [];
  }

  const seen = new Set<string>();
  const refs: { schema: string; table: string }[] = [];
  for (const ref of aliasMap.values()) {
    const k = `${ref.schema}\0${ref.table}`;
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    refs.push(ref);
    if (refs.length >= MAX_TABLES) {
      break;
    }
  }

  const { fetch } = useSchemaStore.getState();
  const out: monaco.languages.CompletionItem[] = [];

  for (const ref of refs) {
    if (token.isCancellationRequested) {
      return out;
    }
    let columns: models.ColumnDetail[];
    try {
      columns = (await fetch(
        columnsCacheKey(connId, ref.schema, ref.table),
        () => GetColumns(connId, ref.schema, ref.table)
      )) as models.ColumnDetail[];
    } catch {
      continue;
    }
    const tableTag = `${ref.schema}.${ref.table}`;
    for (const c of columns ?? []) {
      if (!c.name) {
        continue;
      }
      out.push({
        label: c.name,
        kind: Kind.Field,
        detail: `${tableTag} · ${columnDetail(c)}`,
        insertText: `${c.name} `,
        sortText: `1_frm_${c.name}_${tableTag}`,
        range,
      });
    }
  }
  return out;
}
