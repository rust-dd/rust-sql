import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import pgWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";

import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { setupLanguageFeatures } from "monaco-sql-languages/esm/setupLanguageFeatures";
import { LanguageIdEnum } from "monaco-sql-languages/esm/common/constants";
import { registerContextAwareCompletions } from "./completion-provider";

// @ts-expect-error MonacoEnvironment is attached to global scope at runtime
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === "pgsql") {
      return new pgWorker();
    }
    return new editorWorker();
  },
};

loader.config({ monaco });

setupLanguageFeatures(LanguageIdEnum.PG, {
  completionItems: {
    enable: false, // Disabled: our custom provider handles completions
  },
  diagnostics: true,
  definitions: true,
  references: true,
});

// Register our custom completion provider once, at init time
registerContextAwareCompletions(monaco);

monaco.editor.defineTheme("rsql-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "", foreground: "1a1a2e" },
    { token: "keyword", foreground: "7c3aed", fontStyle: "bold" },
    { token: "keyword.sql", foreground: "7c3aed", fontStyle: "bold" },
    { token: "operator.sql", foreground: "7c3aed" },
    { token: "string", foreground: "059669" },
    { token: "string.sql", foreground: "059669" },
    { token: "number", foreground: "b45309" },
    { token: "number.sql", foreground: "b45309" },
    { token: "comment", foreground: "9999a8", fontStyle: "italic" },
    { token: "comment.sql", foreground: "9999a8", fontStyle: "italic" },
    { token: "identifier", foreground: "1a1a2e" },
    { token: "identifier.sql", foreground: "1a1a2e" },
    { token: "type", foreground: "2563eb" },
    { token: "predefined.sql", foreground: "2563eb" },
    { token: "delimiter", foreground: "666680" },
  ],
  colors: {
    "editor.background": "#fefefe",
    "editor.foreground": "#1a1a2e",
    "editor.lineHighlightBackground": "#f5f5f8",
    "editor.selectionBackground": "#ddd6fe80",
    "editor.inactiveSelectionBackground": "#e2e2e840",
    "editorCursor.foreground": "#7c3aed",
    "editorLineNumber.foreground": "#9999a8",
    "editorLineNumber.activeForeground": "#666680",
    "editorIndentGuide.background": "#e2e2e8",
    "editorIndentGuide.activeBackground": "#c4c4d0",
    "editorGutter.background": "#fefefe",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e2e2e8",
    "editorSuggestWidget.background": "#ffffff",
    "editorSuggestWidget.border": "#e2e2e8",
    "editorSuggestWidget.selectedBackground": "#f0f0f4",
    "editorSuggestWidget.highlightForeground": "#7c3aed",
    "input.background": "#f5f5f8",
    "input.border": "#e2e2e8",
    "scrollbarSlider.background": "#e2e2e840",
    "scrollbarSlider.hoverBackground": "#c4c4d060",
    "scrollbarSlider.activeBackground": "#9999a880",
  },
});

monaco.editor.defineTheme("rsql-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "d4d0e8" },
    { token: "keyword", foreground: "a78bfa", fontStyle: "bold" },
    { token: "keyword.sql", foreground: "a78bfa", fontStyle: "bold" },
    { token: "operator.sql", foreground: "a78bfa" },
    { token: "string", foreground: "34d399" },
    { token: "string.sql", foreground: "34d399" },
    { token: "number", foreground: "fbbf24" },
    { token: "number.sql", foreground: "fbbf24" },
    { token: "comment", foreground: "6b6b80", fontStyle: "italic" },
    { token: "comment.sql", foreground: "6b6b80", fontStyle: "italic" },
    { token: "identifier", foreground: "d4d0e8" },
    { token: "identifier.sql", foreground: "d4d0e8" },
    { token: "type", foreground: "60a5fa" },
    { token: "predefined.sql", foreground: "60a5fa" },
    { token: "delimiter", foreground: "8888a0" },
  ],
  colors: {
    "editor.background": "#1c1a2e",
    "editor.foreground": "#d4d0e8",
    "editor.lineHighlightBackground": "#252340",
    "editor.selectionBackground": "#7c3aed40",
    "editor.inactiveSelectionBackground": "#7c3aed20",
    "editorCursor.foreground": "#a78bfa",
    "editorLineNumber.foreground": "#4a4860",
    "editorLineNumber.activeForeground": "#8888a0",
    "editorIndentGuide.background": "#2a2845",
    "editorIndentGuide.activeBackground": "#3a3860",
    "editorGutter.background": "#1c1a2e",
    "editorWidget.background": "#222040",
    "editorWidget.border": "#2a2845",
    "editorSuggestWidget.background": "#222040",
    "editorSuggestWidget.border": "#2a2845",
    "editorSuggestWidget.selectedBackground": "#302e50",
    "editorSuggestWidget.highlightForeground": "#a78bfa",
    "input.background": "#1c1a2e",
    "input.border": "#2a2845",
    "scrollbarSlider.background": "#2a284540",
    "scrollbarSlider.hoverBackground": "#3a386060",
    "scrollbarSlider.activeBackground": "#4a486080",
  },
});
