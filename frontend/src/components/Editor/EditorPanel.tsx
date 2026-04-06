import { useCallback, useRef } from "react";
import { App as AntdApp } from "antd";
import { ExecuteSQL } from "../../../wailsjs/go/main/App";
import { useConnectionStore } from "../../stores/connectionStore";
import { useEditorStore } from "../../stores/editorStore";
import type { QueryResult } from "../../types";
import { EditorTabs } from "./EditorTabs";
import { EditorToolbar } from "./EditorToolbar";
import {
  SQLEditor,
  type FormatSqlResult,
  type SQLEditorHandle,
} from "./SQLEditor";

function errorResult(message: string): QueryResult {
  return {
    columns: null,
    rows: null,
    rowCount: 0,
    execTimeMs: 0,
    messages: [message],
    hasMore: false,
    dbmsOutputLines: null,
  };
}

export function EditorPanel() {
  const { message } = AntdApp.useApp();
  const editorRef = useRef<SQLEditorHandle>(null);

  const activeConnectionId = useConnectionStore((s) => s.activeConnectionId);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const applyExecutionResult = useEditorStore((s) => s.applyExecutionResult);
  const setExecuteLoading = useEditorStore((s) => s.setExecuteLoading);
  const executeLoading = useEditorStore((s) => s.executeLoading);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const runExecute = useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    const fromEditor = editorRef.current?.getSqlToExecute().trim() ?? "";
    const fromStore = tab?.content.trim() ?? "";
    const sql = fromEditor || fromStore;
    if (!sql) {
      message.warning("No SQL to run");
      return;
    }

    const connId = tab?.connectionId?.trim() || activeConnectionId || "";
    if (!connId) {
      message.warning("Connect to a database or pick a connection for this tab");
      return;
    }

    setExecuteLoading(true);
    try {
      const res = await ExecuteSQL(connId, sql, 500);
      applyExecutionResult(activeTabId, res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      applyExecutionResult(activeTabId, errorResult(msg));
      message.error("Execution failed");
    } finally {
      setExecuteLoading(false);
    }
  }, [
    activeTabId,
    activeConnectionId,
    message,
    setExecuteLoading,
    applyExecutionResult,
    tabs,
  ]);

  const runFormat = useCallback(() => {
    const r = editorRef.current?.formatSql();
    if (!r) {
      return;
    }
    if (!r.ok) {
      message.error(r.error);
    }
  }, [message]);

  const onFormatResult = useCallback(
    (r: FormatSqlResult) => {
      if (!r.ok) {
        message.error(r.error);
      }
    },
    [message]
  );

  if (!activeTab) {
    return null;
  }

  return (
    <div className="editor-panel">
      <EditorToolbar onRun={() => void runExecute()} onFormat={runFormat} />
      <div className="editor-panel-tabs">
        <EditorTabs />
      </div>
      <div className="editor-monaco-wrap">
        <SQLEditor
          key={activeTabId}
          ref={editorRef}
          value={activeTab.content}
          onChange={(v) => updateContent(activeTabId, v)}
          onExecute={() => void runExecute()}
          onFormatResult={onFormatResult}
        />
      </div>
    </div>
  );
}
