import type { ReactNode } from "react";
import { Tag } from "antd";
import { useConnectionStore } from "../../stores/connectionStore";
import { useEditorStore } from "../../stores/editorStore";
import "./layout.css";

export function StatusBar() {
  const {
    connections,
    activeConnectionId,
    isConnected,
    connectionStatus,
    connectionError,
  } = useConnectionStore();

  const { activeTabId, results } = useEditorStore();

  const profile = connections.find((c) => c.id === activeConnectionId);
  const connLabel = profile?.name || profile?.id || "—";

  const activeResult = results[activeTabId];
  const rowPart =
    activeResult != null && activeResult.rowCount !== undefined
      ? String(activeResult.rowCount)
      : "—";
  const timePart =
    activeResult != null && activeResult.execTimeMs !== undefined
      ? `${activeResult.execTimeMs} ms`
      : "—";

  let statusTag: ReactNode = (
    <Tag color={isConnected ? "success" : "default"}>
      {connectionStatus}
    </Tag>
  );
  if (connectionError && connectionStatus === "error") {
    statusTag = <Tag color="error">error</Tag>;
  }

  return (
    <footer className="status-bar">
      <span className="status-bar-item">
        <span className="status-bar-label">Connection</span>
        <span className="status-bar-value" title={connLabel}>
          {connLabel}
        </span>
      </span>
      <span className="status-bar-item">
        <span className="status-bar-label">Rows</span>
        <span className="status-bar-value">{rowPart}</span>
      </span>
      <span className="status-bar-item">
        <span className="status-bar-label">Time</span>
        <span className="status-bar-value">{timePart}</span>
      </span>
      <span className="status-bar-item" style={{ marginLeft: "auto" }}>
        <span className="status-bar-label">Status</span>
        {statusTag}
      </span>
      {connectionError && connectionStatus === "error" && (
        <span
          className="status-bar-value"
          style={{ maxWidth: 280 }}
          title={connectionError}
        >
          {connectionError}
        </span>
      )}
    </footer>
  );
}
