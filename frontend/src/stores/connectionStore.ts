import { create } from "zustand";
import type { ConnectionConfig, ConnectionStatus } from "../types";
import {
  Connect,
  DeleteConnection,
  Disconnect,
  GetActiveConnectionID,
  GetSavedConnections,
  SaveConnection,
} from "../../wailsjs/go/main/App";
import { useSchemaStore } from "./schemaStore";

export interface ConnectionState {
  connections: ConnectionConfig[];
  activeConnectionId: string;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;

  loadConnections: () => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id?: string) => Promise<void>;
  saveConnection: (cfg: ConnectionConfig) => Promise<ConnectionConfig>;
  deleteConnection: (id: string) => Promise<void>;
  syncActiveFromBackend: () => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: "",
  isConnected: false,
  connectionStatus: "idle",
  connectionError: null,

  loadConnections: async () => {
    set({ connectionError: null });
    try {
      const list = await GetSavedConnections();
      set({ connections: list ?? [] });
      await get().syncActiveFromBackend();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ connectionError: msg, connectionStatus: "error" });
      throw e;
    }
  },

  syncActiveFromBackend: async () => {
    try {
      const active = await GetActiveConnectionID();
      set({
        activeConnectionId: active ?? "",
        isConnected: Boolean(active),
        connectionStatus: active ? "connected" : "idle",
      });
    } catch {
      set({
        activeConnectionId: "",
        isConnected: false,
        connectionStatus: "idle",
      });
    }
  },

  connect: async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      throw new Error("connection id is required");
    }
    set({ connectionStatus: "connecting", connectionError: null });
    try {
      await Connect(trimmed);
      const active = await GetActiveConnectionID();
      set({
        activeConnectionId: active ?? trimmed,
        isConnected: true,
        connectionStatus: "connected",
        connectionError: null,
      });
      const sessionUser =
        get().connections.find((c) => c.id === trimmed)?.username ?? "";
      void import("../editor/sqlCompletionPrefetch").then((mod) => {
        void mod.prefetchAfterConnect(active ?? trimmed, sessionUser);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({
        connectionStatus: "error",
        isConnected: false,
        connectionError: msg,
      });
      throw e;
    }
  },

  disconnect: async (id?: string) => {
    const target =
      id?.trim() ||
      get().activeConnectionId ||
      (await GetActiveConnectionID().catch(() => ""));
    if (!target) {
      set({ isConnected: false, connectionStatus: "idle", activeConnectionId: "" });
      return;
    }
    set({ connectionError: null });
    try {
      await Disconnect(target);
      useSchemaStore.getState().invalidateConnection(target);
      const active = await GetActiveConnectionID().catch(() => "");
      set({
        activeConnectionId: active ?? "",
        isConnected: Boolean(active),
        connectionStatus: active ? "connected" : "idle",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ connectionStatus: "error", connectionError: msg });
      throw e;
    }
  },

  saveConnection: async (cfg: ConnectionConfig) => {
    set({ connectionError: null });
    try {
      const saved = await SaveConnection(cfg);
      await get().loadConnections();
      return saved;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ connectionStatus: "error", connectionError: msg });
      throw e;
    }
  },

  deleteConnection: async (id: string) => {
    const trimmed = id.trim();
    if (!trimmed) {
      throw new Error("connection id is required");
    }
    set({ connectionError: null });
    try {
      await DeleteConnection(trimmed);
      useSchemaStore.getState().invalidateConnection(trimmed);
      const wasActive = get().activeConnectionId === trimmed;
      await get().loadConnections();
      if (wasActive) {
        set({
          activeConnectionId: "",
          isConnected: false,
          connectionStatus: "idle",
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ connectionStatus: "error", connectionError: msg });
      throw e;
    }
  },
}));
