import { Allotment } from "allotment";
import { EditorPanel } from "../Editor/EditorPanel";
import { ResultPanel } from "../Results/ResultPanel";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import "./layout.css";

export function AppLayout() {
  return (
    <div className="app-layout">
      <div className="app-layout-body">
        <Allotment>
          <Allotment.Pane minSize={160} maxSize={420} preferredSize={260}>
            <Sidebar />
          </Allotment.Pane>
          <Allotment.Pane minSize={320}>
            <Allotment vertical>
              <Allotment.Pane minSize={120} preferredSize="60%">
                <div className="pane-editor">
                  <EditorPanel />
                </div>
              </Allotment.Pane>
              <Allotment.Pane minSize={72} preferredSize="40%">
                <div className="pane-results">
                  <ResultPanel />
                </div>
              </Allotment.Pane>
            </Allotment>
          </Allotment.Pane>
        </Allotment>
      </div>
      <StatusBar />
    </div>
  );
}
