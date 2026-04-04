import { useMemo } from "react";
import {
  App as AntdApp,
  Dropdown,
  Empty,
  List,
  Space,
  Tag,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import {
  CheckCircleFilled,
  StopOutlined,
} from "@ant-design/icons";
import { useConnectionStore } from "../../stores/connectionStore";
import type { ConnectionConfig } from "../../types";

export interface ConnectionListProps {
  onEdit: (config: ConnectionConfig) => void;
}

export function ConnectionList({ onEdit }: ConnectionListProps) {
  const { message, modal } = AntdApp.useApp();
  const {
    connections,
    connect,
    deleteConnection,
    activeConnectionId,
    isConnected,
  } = useConnectionStore();

  const isItemLive = (c: ConnectionConfig) =>
    isConnected && activeConnectionId === c.id;

  const onConnect = async (id: string) => {
    try {
      await connect(id);
      message.success("Connected");
    } catch {
      message.error("Could not connect");
    }
  };

  const confirmDelete = (c: ConnectionConfig) => {
    modal.confirm({
      title: `Delete "${c.name || c.id}"?`,
      content: "This removes the saved profile. It does not drop objects in Oracle.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteConnection(c.id);
          message.success("Connection removed");
        } catch {
          message.error("Could not delete");
        }
      },
    });
  };

  const buildMenu = (c: ConnectionConfig): MenuProps => ({
    items: [
      { key: "connect", label: "Connect" },
      { key: "edit", label: "Edit" },
      { type: "divider" },
      { key: "delete", label: "Delete", danger: true },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === "connect") void onConnect(c.id);
      if (key === "edit") onEdit(c);
      if (key === "delete") confirmDelete(c);
    },
  });

  const sorted = useMemo(
    () =>
      [...connections].sort((a, b) =>
        (a.name || a.id).localeCompare(b.name || b.id, undefined, {
          sensitivity: "base",
        })
      ),
    [connections]
  );

  if (connections.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No saved profiles"
        style={{ marginTop: 24 }}
      />
    );
  }

  return (
    <List
      className="sidebar-list"
      size="small"
      dataSource={sorted}
      renderItem={(item) => (
        <Dropdown menu={buildMenu(item)} trigger={["contextMenu"]}>
          <div style={{ width: "100%" }}>
            <List.Item
              className={
                activeConnectionId === item.id ? "ant-list-item-active" : ""
              }
              onDoubleClick={() => void onConnect(item.id)}
              style={{ marginBottom: 0 }}
            >
              <List.Item.Meta
                avatar={
                  isItemLive(item) ? (
                    <CheckCircleFilled
                      style={{
                        color: "var(--ant-color-success, #49aa19)",
                      }}
                    />
                  ) : (
                    <StopOutlined
                      style={{
                        color:
                          "var(--ant-color-text-tertiary, rgba(255,255,255,0.35))",
                      }}
                    />
                  )
                }
                title={
                  <Space size={6} wrap>
                    <span>{item.name || item.id}</span>
                    {isItemLive(item) && (
                      <Tag color="success" style={{ marginInlineEnd: 0 }}>
                        live
                      </Tag>
                    )}
                  </Space>
                }
                description={
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12 }}
                    ellipsis
                  >
                    {`${item.username}@${item.host}:${item.port}${
                      item.serviceName || item.sid
                        ? ` / ${item.serviceName || item.sid}`
                        : ""
                    }`}
                  </Typography.Text>
                }
              />
            </List.Item>
          </div>
        </Dropdown>
      )}
    />
  );
}
