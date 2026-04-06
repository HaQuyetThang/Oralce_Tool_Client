import {
  GetActiveConnectionID,
  GetMaterializedViews,
  GetSchemas,
  GetTables,
  GetViews,
} from "../../wailsjs/go/main/App";
import { useSchemaStore } from "../stores/schemaStore";
import { sqlCompletionCacheKey, schemaListCacheKey } from "./sqlCompletionKeys";
import { pickDefaultSchema } from "./sqlCompletionSchema";

/**
 * Warm schema list + rel bundle for the default schema after connect (Task 6).
 * Safe if user disconnects quickly: aborts before writing cache when active id changes.
 */
export async function prefetchAfterConnect(
  connId: string,
  sessionUser: string
): Promise<void> {
  const id = connId.trim();
  if (!id) {
    return;
  }
  try {
    let active = await GetActiveConnectionID().catch(() => "");
    if (active !== id) {
      return;
    }

    const { fetch } = useSchemaStore.getState();
    const schemasKey = schemaListCacheKey(id);
    const schemas = (await fetch(schemasKey, () => GetSchemas(id))) as string[];
    const list = schemas ?? [];

    active = await GetActiveConnectionID().catch(() => "");
    if (active !== id) {
      return;
    }

    const defaultSchema = pickDefaultSchema(list, sessionUser);
    if (!defaultSchema) {
      return;
    }

    const relKey = sqlCompletionCacheKey(id, "rel", defaultSchema);
    await fetch(relKey, async () => {
      const a = await GetActiveConnectionID().catch(() => "");
      if (a !== id) {
        throw new Error("prefetch_cancelled");
      }
      const [tables, views, mvs] = await Promise.all([
        GetTables(id, defaultSchema),
        GetViews(id, defaultSchema),
        GetMaterializedViews(id, defaultSchema),
      ]);
      return { tables: tables ?? [], views: views ?? [], mvs: mvs ?? [] };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "prefetch_cancelled") {
      return;
    }
    console.warn("[schema-prefetch]", e);
  }
}
