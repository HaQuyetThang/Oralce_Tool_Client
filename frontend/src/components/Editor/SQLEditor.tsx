import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { formatOracleSql } from "../../utils/sqlFormatter";

export type FormatSqlResult =
  | { ok: true }
  | { ok: false; error: string };

export type SQLEditorHandle = {
  getSqlToExecute: () => string;
  formatSql: () => FormatSqlResult;
};

export interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  /** Called after Format shortcut so UI can surface errors. */
  onFormatResult?: (result: FormatSqlResult) => void;
}

export const SQLEditor = forwardRef<SQLEditorHandle, SQLEditorProps>(
  function SQLEditor({ value, onChange, onExecute, onFormatResult }, ref) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onExecuteRef = useRef(onExecute);
    onExecuteRef.current = onExecute;
    const onFormatResultRef = useRef(onFormatResult);
    onFormatResultRef.current = onFormatResult;

    const formatDocumentOrSelection = useCallback((): FormatSqlResult => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) {
        return { ok: false, error: "Editor not ready" };
      }
      const sel = ed.getSelection();
      const range =
        sel && !sel.isEmpty() ? sel : model.getFullModelRange();
      const raw = model.getValueInRange(range);
      if (!raw.trim()) {
        return { ok: false, error: "Nothing to format" };
      }
      try {
        const formatted = formatOracleSql(raw);
        ed.executeEdits("sql-format", [
          { range, text: formatted, forceMoveMarkers: true },
        ]);
        onChangeRef.current(model.getValue());
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { ok: false, error: msg };
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getSqlToExecute: () => {
          const ed = editorRef.current;
          const model = ed?.getModel();
          if (!ed || !model) {
            return valueRef.current;
          }
          const sel = ed.getSelection();
          if (sel && !sel.isEmpty()) {
            return model.getValueInRange(sel);
          }
          return model.getValue();
        },
        formatSql: formatDocumentOrSelection,
      }),
      [formatDocumentOrSelection]
    );

    const handleMount: OnMount = (ed, monaco) => {
      editorRef.current = ed;
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecuteRef.current();
      });
      ed.addCommand(
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          const r = formatDocumentOrSelection();
          onFormatResultRef.current?.(r);
        }
      );
    };

    return (
      <Editor
        height="100%"
        theme="vs-dark"
        language="sql"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 14,
          minimap: { enabled: false },
          lineNumbers: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
        }}
      />
    );
  }
);
