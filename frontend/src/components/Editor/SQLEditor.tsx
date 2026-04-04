import { forwardRef, useImperativeHandle, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

export type SQLEditorHandle = {
  getSqlToExecute: () => string;
};

export interface SQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
}

export const SQLEditor = forwardRef<SQLEditorHandle, SQLEditorProps>(
  function SQLEditor({ value, onChange, onExecute }, ref) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const valueRef = useRef(value);
    valueRef.current = value;
    const onExecuteRef = useRef(onExecute);
    onExecuteRef.current = onExecute;

    useImperativeHandle(ref, () => ({
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
    }));

    const handleMount: OnMount = (ed, monaco) => {
      editorRef.current = ed;
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onExecuteRef.current();
      });
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
