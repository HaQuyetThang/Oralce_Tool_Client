import { useState } from "react";
import { Input, Modal, Tabs } from "antd";
import { useEditorStore } from "../../stores/editorStore";

export function EditorTabs() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const addTab = useEditorStore((s) => s.addTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const renameTab = useEditorStore((s) => s.renameTab);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const openRename = (id: string, title: string) => {
    setRenameId(id);
    setRenameValue(title);
    setRenameOpen(true);
  };

  const confirmRename = () => {
    if (renameId) {
      renameTab(renameId, renameValue);
    }
    setRenameOpen(false);
    setRenameId(null);
  };

  return (
    <>
      <Tabs
        type="editable-card"
        className="editor-tabs"
        activeKey={activeTabId}
        onChange={setActiveTab}
        onEdit={(key, action) => {
          if (action === "add") {
            addTab();
          } else if (action === "remove") {
            closeTab(String(key));
          }
        }}
        items={tabs.map((t) => ({
          key: t.id,
          closable: tabs.length > 1,
          label: (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                openRename(t.id, t.title);
              }}
              title="Double-click to rename"
            >
              {t.title}
            </span>
          ),
          children: <span className="editor-tab-dummy" aria-hidden />,
        }))}
      />
      <Modal
        title="Rename tab"
        open={renameOpen}
        onOk={confirmRename}
        onCancel={() => {
          setRenameOpen(false);
          setRenameId(null);
        }}
        okText="Rename"
        destroyOnClose
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          autoFocus
        />
      </Modal>
    </>
  );
}
