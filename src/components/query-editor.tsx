import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { registerContextAwareCompletions } from "@/monaco/completion-provider";
import { useUIStore } from "@/stores/ui-store";

interface QueryEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
}

export function QueryEditor({ value, onChange, onExecute }: QueryEditorProps) {
  const theme = useUIStore((s) => s.theme);
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    registerContextAwareCompletions(monaco);
  }, []);

  const handleMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editor.addAction({
        id: "run-query",
        label: "Run Query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onExecuteRef.current(),
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
          theme={theme === "light" ? "vs" : "vs-dark"}
          loading={
            <div className="flex h-full w-full items-center justify-center bg-editor-bg">
              <span className="text-muted-foreground text-sm">Loading editor...</span>
            </div>
          }
          beforeMount={handleBeforeMount}
          options={{
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: "on",
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
            suggestOnTriggerCharacters: true,
          }}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
        />
      </div>
    </div>
  );
}
