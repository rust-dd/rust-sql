import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useUIStore } from "@/stores/ui-store";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  onExplain?: () => void;
}

export function QueryEditor({ value, onChange, onExecute, onExplain }: QueryEditorProps) {
  const theme = useUIStore((s) => s.theme);
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;
  const onExplainRef = useRef(onExplain);
  onExplainRef.current = onExplain;

  const handleMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editor.addAction({
        id: "run-query",
        label: "Run Query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onExecuteRef.current(),
      });
      editor.addAction({
        id: "explain-query",
        label: "Explain Query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
        run: () => onExplainRef.current?.(),
      });
    },
    [],
  );

  return (
    <div
      className="relative flex-1 overflow-hidden bg-[var(--color-editor-bg)]"
      suppressHydrationWarning
    >
      <div className="absolute inset-0 overflow-auto bg-editor-bg">
        <Editor
          height="100%"
          defaultLanguage="pgsql"
          language="pgsql"
          theme={theme === "light" ? "rsql-light" : "rsql-dark"}
          loading={
            <div className="flex h-full w-full items-center justify-center bg-editor-bg">
              <span className="text-muted-foreground text-sm">Loading editor...</span>
            </div>
          }
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "on",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontLigatures: false,
            renderLineHighlight: "all",
            padding: { top: 8, bottom: 8 },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
            wordBasedSuggestions: "currentDocument",
            acceptSuggestionOnEnter: "on",
            tabCompletion: "on",
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showFunctions: true,
              showVariables: true,
              preview: true,
              filterGraceful: true,
            },
          }}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}
