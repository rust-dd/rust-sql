import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import pgWorker from 'monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker'

import 'monaco-sql-languages/esm/languages/pgsql/pgsql.contribution'
import { setupLanguageFeatures } from 'monaco-sql-languages/esm/setupLanguageFeatures'
import { LanguageIdEnum } from 'monaco-sql-languages/esm/common/constants'

// @ts-expect-error MonacoEnvironment is attached to global scope at runtime
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'pgsql') {
      return new pgWorker()
    }
    return new editorWorker()
  },
}

loader.config({ monaco })

setupLanguageFeatures(LanguageIdEnum.PG, {
  completionItems: {
    enable: false, // Disabled: our custom provider handles completions
  },
  diagnostics: true,
  definitions: true,
  references: true,
})
