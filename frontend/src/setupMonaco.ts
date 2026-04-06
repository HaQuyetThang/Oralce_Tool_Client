import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { registerMonacoOracleTheme } from "./editor/monacoOracleTheme";
import { registerOracleSqlCompletionProvider } from "./editor/registerOracleSqlCompletionProvider";

declare global {
  interface Window {
    MonacoEnvironment?: { getWorker: () => Worker };
  }
}

window.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

registerMonacoOracleTheme();

loader.config({ monaco });

registerOracleSqlCompletionProvider();
