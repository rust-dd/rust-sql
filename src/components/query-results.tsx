import { useState } from "react"
import { CheckCircle2, Clock } from "lucide-react"

const mockResults = [
  { id: 1, email: "alice@example.com", name: "Alice Johnson", created_at: "2024-01-15" },
  { id: 2, email: "bob@example.com", name: "Bob Smith", created_at: "2024-01-16" },
  { id: 3, email: "charlie@example.com", name: "Charlie Brown", created_at: "2024-01-17" },
  { id: 4, email: "diana@example.com", name: "Diana Prince", created_at: "2024-01-18" },
  { id: 5, email: "eve@example.com", name: "Eve Anderson", created_at: "2024-01-19" },
  { id: 1, email: "alice@example.com", name: "Alice Johnson", created_at: "2024-01-15" },
  { id: 2, email: "bob@example.com", name: "Bob Smith", created_at: "2024-01-16" },
  { id: 3, email: "charlie@example.com", name: "Charlie Brown", created_at: "2024-01-17" },
  { id: 4, email: "diana@example.com", name: "Diana Prince", created_at: "2024-01-18" },
  { id: 5, email: "eve@example.com", name: "Eve Anderson", created_at: "2024-01-19" },
  { id: 1, email: "alice@example.com", name: "Alice Johnson", created_at: "2024-01-15" },
  { id: 2, email: "bob@example.com", name: "Bob Smith", created_at: "2024-01-16" },
  { id: 3, email: "charlie@example.com", name: "Charlie Brown", created_at: "2024-01-17" },
  { id: 4, email: "diana@example.com", name: "Diana Prince", created_at: "2024-01-18" },
  { id: 5, email: "eve@example.com", name: "Eve Anderson", created_at: "2024-01-19" },
  { id: 1, email: "alice@example.com", name: "Alice Johnson", created_at: "2024-01-15" },
  { id: 2, email: "bob@example.com", name: "Bob Smith", created_at: "2024-01-16" },
  { id: 3, email: "charlie@example.com", name: "Charlie Brown", created_at: "2024-01-17" },
  { id: 4, email: "diana@example.com", name: "Diana Prince", created_at: "2024-01-18" },
  { id: 5, email: "eve@example.com", name: "Eve Anderson", created_at: "2024-01-19" },
  { id: 1, email: "alice@example.com", name: "Alice Johnson", created_at: "2024-01-15" },
  { id: 2, email: "bob@example.com", name: "Bob Smith", created_at: "2024-01-16" },
  { id: 3, email: "charlie@example.com", name: "Charlie Brown", created_at: "2024-01-17" },
  { id: 4, email: "diana@example.com", name: "Diana Prince", created_at: "2024-01-18" },
  { id: 5, email: "eve@example.com", name: "Eve Anderson", created_at: "2024-01-19" },
]

export function QueryResults() {
  const [results] = useState(mockResults)

  return (
    <div className="flex h-full flex-col border-t border-border bg-card">
      {/* Results Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-foreground">RESULTS</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>{results.length} rows</span>
            <span className="text-muted-foreground/50">•</span>
            <Clock className="h-3 w-3" />
            <span>42ms</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 bg-secondary z-10">
            <tr>
              {Object.keys(results[0] || {}).map((key) => (
                <th
                  key={key}
                  className="border-b border-r border-border px-4 py-2 text-left font-semibold text-secondary-foreground whitespace-nowrap"
                >
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row, i) => (
              <tr key={i} className="hover:bg-accent/50 transition-colors">
                {Object.values(row).map((value, j) => (
                  <td key={j} className="border-b border-r border-border px-4 py-2 text-foreground whitespace-nowrap">
                    {String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
