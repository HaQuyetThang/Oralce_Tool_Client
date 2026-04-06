import * as monaco from "monaco-editor";
import {
  GetFunctions,
  GetMaterializedViews,
  GetSchemas,
  GetSynonyms,
  GetTables,
  GetViews,
  GetProcedures,
} from "../../wailsjs/go/main/App";
import type { models } from "../../wailsjs/go/models";
import { useConnectionStore } from "../stores/connectionStore";
import { useSchemaStore } from "../stores/schemaStore";
import { schemaListCacheKey, sqlCompletionCacheKey } from "./sqlCompletionKeys";
import { pickDefaultSchema } from "./sqlCompletionSchema";

const Kind = monaco.languages.CompletionItemKind;

function linePrefixBeforeCursor(
  model: monaco.editor.ITextModel,
  position: monaco.Position
): string {
  const line = model.getLineContent(position.lineNumber);
  return line.slice(0, Math.max(0, position.column - 1));
}

/** After CALL / EXEC / EXECUTE, suggest procedures, functions, synonyms (Task 3.4). */
function wantsCallTargets(prefix: string): boolean {
  return /\b(CALL|EXECUTE|EXEC)\b\s*$/i.test(prefix.trimEnd());
}

/**
 * Schema-aware suggestions: schemas (shared cache key with schema tree), then tables/views/MVs
 * for the default schema (logged-in user schema if listed, else first name lexicographically).
 */
export async function getSqlDynamicCompletionItems(
  connId: string,
  model: monaco.editor.ITextModel,
  position: monaco.Position,
  range: monaco.Range,
  token: monaco.CancellationToken
): Promise<monaco.languages.CompletionItem[]> {
  try {
    const { fetch } = useSchemaStore.getState();
    const connections = useConnectionStore.getState().connections;
    const sessionUser =
      connections.find((c) => c.id === connId)?.username ?? "";

    const schemasKey = schemaListCacheKey(connId);
    const schemas = (await fetch(schemasKey, () =>
      GetSchemas(connId)
    )) as string[];

    if (token.isCancellationRequested) {
      return [];
    }
    if (!schemas?.length) {
      return [];
    }

    const defaultSchema = pickDefaultSchema(schemas, sessionUser);

    const relKey = sqlCompletionCacheKey(connId, "rel", defaultSchema);
    const rel = (await fetch(relKey, async () => {
      const [tables, views, mvs] = await Promise.all([
        GetTables(connId, defaultSchema),
        GetViews(connId, defaultSchema),
        GetMaterializedViews(connId, defaultSchema),
      ]);
      return {
        tables: (tables ?? []) as models.TableInfo[],
        views: views ?? [],
        mvs: mvs ?? [],
      };
    })) as {
      tables: models.TableInfo[];
      views: string[];
      mvs: string[];
    };

    if (token.isCancellationRequested) {
      return [];
    }

    const out: monaco.languages.CompletionItem[] = [];

    for (const s of schemas) {
      out.push({
        label: s,
        kind: Kind.Module,
        detail: "Schema",
        insertText: `${s} `,
        sortText: `3_${s}`,
        range,
      });
    }

    for (const t of rel.tables) {
      const name = t.name;
      if (!name) {
        continue;
      }
      out.push({
        label: name,
        kind: Kind.Struct,
        detail: `Table (${defaultSchema})`,
        insertText: `${name} `,
        sortText: `4_${name}`,
        range,
      });
    }

    for (const v of rel.views) {
      out.push({
        label: v,
        kind: Kind.Interface,
        detail: `View (${defaultSchema})`,
        insertText: `${v} `,
        sortText: `5_${v}`,
        range,
      });
    }

    for (const m of rel.mvs) {
      out.push({
        label: m,
        kind: Kind.Interface,
        detail: `Materialized view (${defaultSchema})`,
        insertText: `${m} `,
        sortText: `6_${m}`,
        range,
      });
    }

    const prefix = linePrefixBeforeCursor(model, position);
    if (defaultSchema && wantsCallTargets(prefix)) {
      const extrasKey = sqlCompletionCacheKey(connId, "extras", defaultSchema);
      const extras = (await fetch(extrasKey, async () => {
        const [syns, procs, funcs] = await Promise.all([
          GetSynonyms(connId, defaultSchema),
          GetProcedures(connId, defaultSchema),
          GetFunctions(connId, defaultSchema),
        ]);
        return {
          syns: syns ?? [],
          procs: procs ?? [],
          funcs: funcs ?? [],
        };
      })) as { syns: string[]; procs: string[]; funcs: string[] };

      if (token.isCancellationRequested) {
        return [];
      }

      for (const p of extras.procs) {
        out.push({
          label: p,
          kind: Kind.Method,
          detail: `Procedure (${defaultSchema})`,
          insertText: `${p} `,
          sortText: `7_${p}`,
          range,
        });
      }
      for (const f of extras.funcs) {
        out.push({
          label: f,
          kind: Kind.Function,
          detail: `Function (${defaultSchema})`,
          insertText: `${f} `,
          sortText: `8_${f}`,
          range,
        });
      }
      for (const sy of extras.syns) {
        out.push({
          label: sy,
          kind: Kind.Reference,
          detail: `Synonym (${defaultSchema})`,
          insertText: `${sy} `,
          sortText: `9_${sy}`,
          range,
        });
      }
    }

    return out;
  } catch (e) {
    console.warn("[sql-completion-dynamic]", e);
    return [];
  }
}
