// monaco-editor is pinned to 0.55.0 on purpose. 0.56 narrowed its `exports`
// map to `"./*": "./esm/vs/*.js"`, and monaco-sql-languages' own worker still
// imports `monaco-editor/esm/vs/editor/editor.worker.js`, which no longer
// resolves — the build fails inside that package. Bumping monaco-editor
// requires monaco-sql-languages to fix its import first.
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import pgWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";

import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";
import { LanguageIdEnum } from "monaco-sql-languages/esm/common/constants";
import { setupLanguageFeatures } from "monaco-sql-languages/esm/setupLanguageFeatures";
import { createCompletionService } from "./completion/service";
import { registerTheme } from "./theme";

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
  // The built-in provider is what parses the statement and reports what the
  // grammar expects at the caret. An earlier version disabled it and matched
  // context with regexes, which could not see aliases, CTEs or scopes.
  completionItems: {
    enable: true,
    completionService: createCompletionService(monaco) as never,
    // Space is deliberately absent: it made the widget open on every word.
    triggerCharacters: ["."],
    snippets: [],
  },
  diagnostics: true,
  definitions: true,
  references: true,
});

registerTheme(monaco);
