/**
 * Cache keys for SQL completion (prefixed with `completion` so they sit beside tree keys like
 * `${connId}\0schemas` but stay grouped for documentation). `invalidateConnection(connId)`
 * clears every key starting with `${connId}\0`, including these.
 */
export function sqlCompletionCacheKey(
  connId: string,
  ...segments: string[]
): string {
  return [connId, "completion", ...segments].join("\0");
}

/** Same as SchemaTree: one shared `GetSchemas` cache per connection. */
export function schemaListCacheKey(connId: string): string {
  return `${connId}\0schemas`;
}

/** Column list for dot-completion (invalidated with connection). */
export function columnsCacheKey(
  connId: string,
  schema: string,
  table: string
): string {
  return sqlCompletionCacheKey(connId, "columns", schema, table);
}
