import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import type { EditorInsertionRequest } from "./queryTabTypes";

interface SqlEditorProps {
  diagnosticRange: { start: number; end: number; message: string } | null;
  highlightedRange: { start: number; end: number } | null;
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

export function SqlEditor({
  diagnosticRange,
  highlightedRange,
  insertionRequest,
  onExecute,
  onNewTab,
  onSave,
  onSqlChange,
  sql
}: SqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

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

  useEffect(() => {
    const editorInstance = editorRef.current;
    const model = editorInstance?.getModel();

    if (editorInstance === null || editorInstance === undefined || model === null || model === undefined) {
      return;
    }

    if (highlightedRange === null) {
      decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const startPosition = model.getPositionAt(highlightedRange.start);
    const endPosition = model.getPositionAt(highlightedRange.end);
    const range = {
      startLineNumber: startPosition.lineNumber,
      startColumn: startPosition.column,
      endLineNumber: endPosition.lineNumber,
      endColumn: endPosition.column
    };

    decorationIdsRef.current = editorInstance.deltaDecorations(decorationIdsRef.current, [
      {
        range,
        options: {
          className: "sql-trace-highlight",
          inlineClassName: "sql-trace-highlight-inline",
          overviewRuler: {
            color: "#8b6cff",
            position: 2
          }
        }
      }
    ]);
    editorInstance.revealRangeInCenterIfOutsideViewport(range);
  }, [highlightedRange]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    const model = editorInstance?.getModel();
    const monaco = monacoRef.current;

    if (editorInstance === null || editorInstance === undefined || model === null || model === undefined || monaco === null) {
      return;
    }

    if (diagnosticRange === null) {
      monaco.editor.setModelMarkers(model, "kansodb", []);
      return;
    }

    const startPosition = model.getPositionAt(diagnosticRange.start);
    const endPosition = model.getPositionAt(Math.max(diagnosticRange.end, diagnosticRange.start + 1));
    monaco.editor.setModelMarkers(model, "kansodb", [
      {
        severity: monaco.MarkerSeverity.Error,
        message: diagnosticRange.message,
        startLineNumber: startPosition.lineNumber,
        startColumn: startPosition.column,
        endLineNumber: endPosition.lineNumber,
        endColumn: endPosition.column
      }
    ]);
  }, [diagnosticRange]);

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
    monacoRef.current = monaco;
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
