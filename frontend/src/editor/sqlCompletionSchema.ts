import { GetSchemas } from "../../wailsjs/go/main/App";
import { useConnectionStore } from "../stores/connectionStore";
import { useSchemaStore } from "../stores/schemaStore";
import { schemaListCacheKey } from "./sqlCompletionKeys";

/** Prefer session (connection username) schema when listed; else first name lexicographically. */
export function pickDefaultSchema(
  schemas: string[],
  sessionUser?: string
): string {
  if (schemas.length === 0) {
    return "";
  }
  const trimmed = sessionUser?.trim();
  if (trimmed) {
    const u = trimmed.toUpperCase();
    const exact = schemas.find((s) => s.toUpperCase() === u);
    if (exact) {
      return exact;
    }
  }
  const sorted = [...schemas].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  return sorted[0] ?? "";
}

/**
 * Cached schema list + default schema. Pass `sessionUser` when known (e.g. prefetch) to avoid
 * relying on connectionStore during module init ordering.
 */
export async function getDefaultSchemaForConnection(
  connId: string,
  sessionUser?: string
): Promise<{ schemas: string[]; defaultSchema: string }> {
  const { fetch } = useSchemaStore.getState();
  const user =
    sessionUser !== undefined
      ? sessionUser
      : useConnectionStore.getState().connections.find((c) => c.id === connId)
          ?.username ?? "";
  const schemasKey = schemaListCacheKey(connId);
  const schemas = (await fetch(schemasKey, () =>
    GetSchemas(connId)
  )) as string[];
  const list = schemas ?? [];
  return {
    schemas: list,
    defaultSchema: pickDefaultSchema(list, user),
  };
}
