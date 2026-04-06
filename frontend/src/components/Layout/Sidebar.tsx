import { useEffect, useState } from "react";
import { App as AntdApp, Button, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ConnectionDialog } from "../Connection/ConnectionDialog";
import { ConnectionList } from "../Connection/ConnectionList";
import { SchemaTree } from "../Schema/SchemaTree";
import { useConnectionStore } from "../../stores/connectionStore";
import type { ConnectionConfig } from "../../types";

export function Sidebar() {
  const { message } = AntdApp.useApp();
  const { loadConnections, activeConnectionId, isConnected } =
    useConnectionStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ConnectionConfig | null>(
    null
  );

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const openNew = () => {
    setDialogInitial(null);
    setDialogOpen(true);
  };

  const openEdit = (c: ConnectionConfig) => {
    setDialogInitial(c);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setDialogInitial(null);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            Connections
          </Typography.Text>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            size="small"
            onClick={openNew}
          >
            New connection
          </Button>
        </Space>
      </div>
      <div className="sidebar-list-wrap">
        <ConnectionList
          onEdit={(c) => {
            if (!c?.id) {
              message.warning("This profile has no id; create a new connection.");
              return;
            }
            openEdit(c);
          }}
        />
      </div>
      <div className="sidebar-schema-wrap">
        <SchemaTree
          connectionId={isConnected ? activeConnectionId : ""}
        />
      </div>

      <ConnectionDialog
        open={dialogOpen}
        initial={dialogInitial}
        onClose={closeDialog}
      />
    </div>
  );
}
