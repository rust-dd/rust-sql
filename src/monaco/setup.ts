import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import pgWorker from 'monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker'

import 'monaco-sql-languages/esm/languages/pgsql/pgsql.contribution'
import { setupLanguageFeatures } from 'monaco-sql-languages/esm/setupLanguageFeatures'
import { LanguageIdEnum } from 'monaco-sql-languages/esm/common/constants'

// Map workers for Monaco when using Vite bundling
// @ts-expect-error MonacoEnvironment is attached to global scope at runtime
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'pgsql') {
      return new pgWorker()
    }
    return new editorWorker()
  },
}

// Ensure @monaco-editor/react uses the ESM monaco instance
loader.config({ monaco })

// Configure monaco-sql-languages features for pgsql
const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'.split('')
setupLanguageFeatures(LanguageIdEnum.PG, {
  completionItems: {
    enable: true,
    triggerCharacters: ['.', ' ', ...letters],
  },
  diagnostics: true,
  definitions: true,
  references: true,
})

