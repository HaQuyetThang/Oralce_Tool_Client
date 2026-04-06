import * as monaco from "monaco-editor";

export const MONACO_THEME_ORACLE_SQL = "oracle-sql-lite-dark";

/** Explicit colors for dark UI; helps WebView2 / embedded Chromium if default tokens fail. */
export function registerMonacoOracleTheme(): void {
  monaco.editor.defineTheme(MONACO_THEME_ORACLE_SQL, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1e1e1e",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#858585",
      "editorLineNumber.activeForeground": "#c6c6c6",
      "editorCursor.foreground": "#d4d4d4",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#3a3d41",
    },
  });
}
