import { useCallback } from "react";
import {
  App as AntdApp,
  Button,
  Flex,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckOutlined,
  FormatPainterOutlined,
  PlayCircleOutlined,
  RollbackOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { CancelQuery, Commit, Rollback } from "../../../wailsjs/go/main/App";
import { useConnectionStore } from "../../stores/connectionStore";
import { useEditorStore } from "../../stores/editorStore";

export interface EditorToolbarProps {
  onRun: () => void;
  onFormat?: () => void;
}

export function EditorToolbar({ onRun, onFormat }: EditorToolbarProps) {
  const { message } = AntdApp.useApp();
  const { connections, activeConnectionId } = useConnectionStore();
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const setTabConnection = useEditorStore((s) => s.setTabConnection);
  const executeLoading = useEditorStore((s) => s.executeLoading);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const tabConn = activeTab?.connectionId?.trim() ?? "";
  const effectiveConn = tabConn || activeConnectionId || "";
  const canTransact = Boolean(effectiveConn);

  const runFromToolbar = useCallback(() => {
    onRun();
  }, [onRun]);

  const doCommit = async () => {
    if (!effectiveConn) {
      message.warning("No connection selected");
      return;
    }
    try {
      await Commit(tabConn || "");
      message.success("Committed");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const doCancel = async () => {
    if (!effectiveConn) {
      message.warning("No connection selected");
      return;
    }
    try {
      await CancelQuery(tabConn || "");
      message.info("Cancel requested");
    } catch (e) {
      message.warning(e instanceof Error ? e.message : String(e));
    }
  };

  const doRollback = async () => {
    if (!effectiveConn) {
      message.warning("No connection selected");
      return;
    }
    try {
      await Rollback(tabConn || "");
      message.success("Rolled back");
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };

  const connOptions = [
    { value: "", label: "Active connection" },
    ...connections.map((c) => ({
      value: c.id,
      label: c.name || c.id,
    })),
  ];

  return (
    <Flex className="editor-toolbar" align="center" gap={10} wrap="wrap">
      <Space size={6} wrap>
        <Tooltip title="Run SQL (selection if any, else whole script)">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={executeLoading}
            onClick={runFromToolbar}
          >
            Run
          </Button>
        </Tooltip>
        <Tooltip title="Format SQL (selection if any, else whole script) — Shift+Alt+F">
          <Button
            icon={<FormatPainterOutlined />}
            disabled={!onFormat}
            onClick={() => onFormat?.()}
          >
            Format
          </Button>
        </Tooltip>
        <Tooltip title="Cancel running query (same connection as this tab)">
          <Button
            icon={<StopOutlined />}
            disabled={!executeLoading || !effectiveConn}
            onClick={() => void doCancel()}
          >
            Stop
          </Button>
        </Tooltip>
        <Tooltip title="COMMIT (current session on pool)">
          <Button
            icon={<CheckOutlined />}
            disabled={!canTransact}
            onClick={() => void doCommit()}
          >
            Commit
          </Button>
        </Tooltip>
        <Tooltip title="ROLLBACK (current session on pool)">
          <Button
            icon={<RollbackOutlined />}
            disabled={!canTransact}
            onClick={() => void doRollback()}
          >
            Rollback
          </Button>
        </Tooltip>
      </Space>

      <Select
        className="editor-toolbar-connection"
        placeholder="Connection for this tab"
        value={tabConn || undefined}
        allowClear
        options={connOptions}
        onChange={(v) => setTabConnection(activeTabId, v ?? "")}
        style={{ minWidth: 200 }}
        popupMatchSelectWidth={false}
      />

      <Typography.Text
        type="secondary"
        className="editor-toolbar-hint"
        style={{ fontSize: 12, marginLeft: "auto" }}
      >
        Ctrl+Enter — run · Shift+Alt+F — format
      </Typography.Text>
    </Flex>
  );
}
