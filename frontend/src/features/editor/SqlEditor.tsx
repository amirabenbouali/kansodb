import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import type { EditorInsertionRequest } from "./queryTabTypes";

interface SqlEditorProps {
  insertionRequest: EditorInsertionRequest | null;
  onExecute: () => void;
  onNewTab: () => void;
  onSave: () => void;
  onSqlChange: (sql: string) => void;
  sql: string;
}

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  bracketPairColorization: { enabled: true },
  cursorBlinking: "smooth",
  cursorSmoothCaretAnimation: "on",
  find: {
    addExtraSpaceOnTop: false,
    autoFindInSelection: "never",
    seedSearchStringFromSelection: "selection"
  },
  fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
  fontLigatures: false,
  fontSize: 14,
  lineHeight: 24,
  lineNumbers: "on",
  matchBrackets: "always",
  minimap: { enabled: false },
  padding: { top: 14, bottom: 14 },
  renderLineHighlight: "line",
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
  wordWrap: "off"
};

export function SqlEditor({ insertionRequest, onExecute, onNewTab, onSave, onSqlChange, sql }: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    if (insertionRequest === null || editorRef.current === null) {
      return;
    }

    const editorInstance = editorRef.current;
    const selection = editorInstance.getSelection();
    const range = selection ?? editorInstance.getModel()?.getFullModelRange();

    if (range === undefined) {
      return;
    }

    editorInstance.executeEdits("schema-explorer", [
      {
        range,
        text: insertionRequest.text,
        forceMoveMarkers: true
      }
    ]);
    editorInstance.focus();
  }, [insertionRequest]);

  const beforeMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("kanso-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword.sql", foreground: "b79fff" },
        { token: "string.sql", foreground: "8fd694" },
        { token: "number.sql", foreground: "f4c77e" },
        { token: "operator.sql", foreground: "a5adba" }
      ],
      colors: {
        "editor.background": "#161a23",
        "editor.foreground": "#e6e9ef",
        "editor.lineHighlightBackground": "#1b2030",
        "editorLineNumber.foreground": "#737b89",
        "editorLineNumber.activeForeground": "#a5adba",
        "editorCursor.foreground": "#8b6cff",
        "editor.selectionBackground": "#3a315f",
        "editor.inactiveSelectionBackground": "#2a2f3a",
        "editor.findMatchBackground": "#5a4f28",
        "editor.findMatchHighlightBackground": "#3b3520"
      }
    });
  };

  const handleMount: OnMount = (editorInstance, monaco) => {
    editorRef.current = editorInstance;
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onExecute);
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyT, onNewTab);
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, onSave);
  };

  return (
    <div className="monaco-shell">
      <Editor
        beforeMount={beforeMount}
        defaultLanguage="sql"
        language="sql"
        onChange={(value) => onSqlChange(value ?? "")}
        onMount={handleMount}
        options={editorOptions}
        theme="kanso-dark"
        value={sql}
      />
    </div>
  );
}
