import { create } from "zustand";

/**
 * Simple fetch cache for schema browser (keyed by connection + request path).
 * Invalidate when disconnecting or when user refreshes tree.
 */
export interface SchemaCacheState {
  cache: Record<string, unknown>;
  /** Returns cached value or runs fetcher and stores result. */
  fetch: (key: string, fetcher: () => Promise<unknown>) => Promise<unknown>;
  invalidateConnection: (connId: string) => void;
  invalidateKey: (key: string) => void;
  clear: () => void;
}

export const useSchemaStore = create<SchemaCacheState>((set, get) => ({
  cache: {},

  fetch: async (key: string, fetcher: () => Promise<unknown>) => {
    const hit = get().cache[key];
    if (hit !== undefined) {
      return hit;
    }
    const data = await fetcher();
    set((s) => ({ cache: { ...s.cache, [key]: data } }));
    return data;
  },

  invalidateConnection: (connId: string) => {
    const prefix = `${connId}\0`;
    set((s) => {
      const next = { ...s.cache };
      for (const k of Object.keys(next)) {
        if (k.startsWith(prefix) || k === connId) {
          delete next[k];
        }
      }
      return { cache: next };
    });
  },

  invalidateKey: (key: string) => {
    set((s) => {
      const next = { ...s.cache };
      delete next[key];
      return { cache: next };
    });
  },

  clear: () => set({ cache: {} }),
}));
