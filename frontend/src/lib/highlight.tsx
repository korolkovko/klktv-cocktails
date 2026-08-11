import * as React from "react"

// Подсветка совпадения запроса в меню с поиском (combobox, command).
// Канон §18: подсветка — PROFIT, НИКОГДА не BUTTER (BUTTER — ховер строки).
export function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-profit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}
