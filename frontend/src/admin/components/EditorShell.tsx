import * as React from "react"

// Modal editor chrome shared by every per-entity editor (Tasks 8-10):
// title + scrollable body (the caller's form fields) + Save/Cancel, with an
// optional Delete pinned to the footer's left side. Plain fixed-overlay
// modal, no design-kit dependency (see FormFields.tsx header comment).
export function EditorShell({
  title,
  onSave,
  onClose,
  onDelete,
  saving,
  saveLabel = "Сохранить",
  saveDisabled,
  children,
}: {
  title: string
  onSave: () => void | Promise<void>
  onClose: () => void
  onDelete?: () => void | Promise<void>
  saving?: boolean
  saveLabel?: string
  saveDisabled?: boolean
  children: React.ReactNode
}) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-4 py-3">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={() => void onDelete()}
                className="rounded px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Удалить
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || saveDisabled}
              className="rounded bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? "Сохранение…" : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
