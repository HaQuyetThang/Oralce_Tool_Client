import { useConnectionStore } from "../stores/connectionStore";
import { useEditorStore } from "../stores/editorStore";

/**
 * Connection id for SQL IntelliSense — same rule as Execute in EditorPanel:
 * worksheet `connectionId` when set, otherwise global `activeConnectionId`.
 */
export function getSqlCompletionConnectionId(): string {
  try {
    const { tabs, activeTabId } = useEditorStore.getState();
    const { activeConnectionId } = useConnectionStore.getState();
    const tab = tabs.find((t) => t.id === activeTabId);
    return tab?.connectionId?.trim() || activeConnectionId || "";
  } catch {
    return "";
  }
}
