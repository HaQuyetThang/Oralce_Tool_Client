import { Empty, Tabs } from "antd";
import { useEditorStore, type ResultSubTab } from "../../stores/editorStore";
import { hasResultGrid } from "../../utils/queryResult";
import { DataGrid } from "./DataGrid";
import { MessagesPanel } from "./MessagesPanel";

import "./results.css";

export function ResultPanel() {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const results = useEditorStore((s) => s.results);
  const resultReceivedAt = useEditorStore((s) => s.resultReceivedAt);
  const resultSubTabByTab = useEditorStore((s) => s.resultSubTabByTab);
  const setResultSubTab = useEditorStore((s) => s.setResultSubTab);

  const result = results[activeTabId] ?? null;
  const receivedAt = resultReceivedAt[activeTabId] ?? Date.now();

  const showGrid = result != null && hasResultGrid(result);
  const storedSub: ResultSubTab =
    resultSubTabByTab[activeTabId] ?? (showGrid ? "results" : "messages");
  const innerTab: ResultSubTab =
    storedSub === "results" && !showGrid ? "messages" : storedSub;

  if (result == null) {
    return (
      <div className="result-panel">
        <div className="result-panel-empty-wrap">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Run SQL to see results"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="result-panel">
      <Tabs
        activeKey={innerTab}
        onChange={(k) =>
          setResultSubTab(activeTabId, k as ResultSubTab)
        }
        items={[
          {
            key: "results",
            label: "Results",
            disabled: !showGrid,
            children: showGrid ? (
              <DataGrid result={result} />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No grid for this execution (try Messages)"
                style={{ marginTop: 16 }}
              />
            ),
          },
          {
            key: "messages",
            label: "Messages",
            children: <MessagesPanel result={result} receivedAt={receivedAt} />,
          },
        ]}
      />
    </div>
  );
}
