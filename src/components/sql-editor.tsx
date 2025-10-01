import { useEffect, useRef } from "react"

interface SQLEditorProps {
  value: string
  onChange: (value: string) => void
}

export function SQLEditor({ value, onChange }: SQLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  return (
    <div className="relative flex-1 overflow-hidden bg-[var(--color-editor-bg)]">
      <div className="absolute inset-0 overflow-auto">
        <div className="flex min-h-full">
          {/* Line Numbers */}
          <div className="select-none border-r border-border bg-card px-3 py-4 font-mono text-xs text-muted-foreground">
            {value.split("\n").map((_, i) => (
              <div key={i} className="leading-6 text-right">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="flex-1 p-4">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full resize-none bg-transparent font-mono text-sm leading-6 text-foreground outline-none"
              placeholder="-- Write your SQL query here..."
              spellCheck={false}
              style={{ minHeight: "300px" }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
