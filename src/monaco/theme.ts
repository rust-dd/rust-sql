import type * as Monaco from "monaco-editor";

const RULES = [
  { token: "", light: "1a1a2e", dark: "d4d0e8" },
  { token: "keyword", light: "7c3aed", dark: "a78bfa", bold: true },
  { token: "keyword.sql", light: "7c3aed", dark: "a78bfa", bold: true },
  { token: "operator.sql", light: "7c3aed", dark: "a78bfa" },
  { token: "string", light: "059669", dark: "34d399" },
  { token: "string.sql", light: "059669", dark: "34d399" },
  { token: "number", light: "b45309", dark: "fbbf24" },
  { token: "number.sql", light: "b45309", dark: "fbbf24" },
  { token: "comment", light: "9999a8", dark: "6b6b80", italic: true },
  { token: "comment.sql", light: "9999a8", dark: "6b6b80", italic: true },
  { token: "identifier", light: "1a1a2e", dark: "d4d0e8" },
  { token: "identifier.sql", light: "1a1a2e", dark: "d4d0e8" },
  { token: "type", light: "2563eb", dark: "60a5fa" },
  { token: "predefined.sql", light: "2563eb", dark: "60a5fa" },
  { token: "delimiter", light: "666680", dark: "8888a0" },
] as const;

function rules(mode: "light" | "dark"): Monaco.editor.ITokenThemeRule[] {
  return RULES.map((rule) => ({
    token: rule.token,
    foreground: mode === "light" ? rule.light : rule.dark,
    fontStyle: [
      "bold" in rule && rule.bold ? "bold" : "",
      "italic" in rule && rule.italic ? "italic" : "",
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

const LIGHT_COLORS: Record<string, string> = {
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
  "editorWidget.foreground": "#1a1a2e",
  "editorSuggestWidget.background": "#ffffff",
  "editorSuggestWidget.border": "#e2e2e8",
  "editorSuggestWidget.foreground": "#1a1a2e",
  "editorSuggestWidget.selectedBackground": "#f0f0f4",
  "editorSuggestWidget.selectedForeground": "#1a1a2e",
  "editorSuggestWidget.selectedIconForeground": "#7c3aed",
  "editorSuggestWidget.highlightForeground": "#6d28d9",
  "editorSuggestWidget.focusHighlightForeground": "#6d28d9",
  "editorHoverWidget.background": "#ffffff",
  "editorHoverWidget.border": "#e2e2e8",
  "editorHoverWidget.foreground": "#1a1a2e",
  // The dimmed second column of a suggestion: type, key flags, comment.
  descriptionForeground: "#5a5a70",
  "symbolIcon.fieldForeground": "#0f766e",
  "symbolIcon.classForeground": "#b45309",
  "symbolIcon.functionForeground": "#7c3aed",
  "symbolIcon.moduleForeground": "#2563eb",
  "symbolIcon.keywordForeground": "#666680",
  "symbolIcon.snippetForeground": "#666680",
  "input.background": "#f5f5f8",
  "input.border": "#e2e2e8",
  "scrollbarSlider.background": "#e2e2e840",
  "scrollbarSlider.hoverBackground": "#c4c4d060",
  "scrollbarSlider.activeBackground": "#9999a880",
};

const DARK_COLORS: Record<string, string> = {
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
  "editorWidget.foreground": "#e4e1f4",
  "editorSuggestWidget.background": "#222040",
  "editorSuggestWidget.border": "#3a3860",
  "editorSuggestWidget.foreground": "#e4e1f4",
  "editorSuggestWidget.selectedBackground": "#3a3768",
  "editorSuggestWidget.selectedForeground": "#ffffff",
  "editorSuggestWidget.selectedIconForeground": "#c4b5fd",
  // Lighter than the editor's keyword purple: this sits on both the plain and
  // the selected row, and the darker tone failed against the selected one.
  "editorSuggestWidget.highlightForeground": "#c4b5fd",
  "editorSuggestWidget.focusHighlightForeground": "#ddd6fe",
  "editorHoverWidget.background": "#222040",
  "editorHoverWidget.border": "#3a3860",
  "editorHoverWidget.foreground": "#e4e1f4",
  // The dimmed second column of a suggestion: type, key flags, comment.
  descriptionForeground: "#a9a4c4",
  "symbolIcon.fieldForeground": "#5eead4",
  "symbolIcon.classForeground": "#fbbf24",
  "symbolIcon.functionForeground": "#c4b5fd",
  "symbolIcon.moduleForeground": "#7dd3fc",
  "symbolIcon.keywordForeground": "#a9a4c4",
  "symbolIcon.snippetForeground": "#a9a4c4",
  "input.background": "#1c1a2e",
  "input.border": "#2a2845",
  "scrollbarSlider.background": "#2a284540",
  "scrollbarSlider.hoverBackground": "#3a386060",
  "scrollbarSlider.activeBackground": "#4a486080",
};

export function registerTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme("rsql-light", {
    base: "vs",
    inherit: true,
    rules: rules("light"),
    colors: LIGHT_COLORS,
  });

  monaco.editor.defineTheme("rsql-dark", {
    base: "vs-dark",
    inherit: true,
    rules: rules("dark"),
    colors: DARK_COLORS,
  });
}
