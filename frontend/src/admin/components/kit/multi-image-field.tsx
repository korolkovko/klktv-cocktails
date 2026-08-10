import * as React from "react"
import { ArrowDown, ArrowUp, X } from "lucide-react"

import { resolveImageUrl } from "@/lib/img"
import { Button } from "@/components/ui/button"
import { FieldHint } from "./form"

import { adminApi } from "../../api"

// Kit-styled MULTI-image upload (Task C3) — sibling of ImageField, same
// upload pipeline (file → adminApi.uploadImage → the returned
// `/static/img/…` url), but for an ORDERED array (drink.photos) instead of a
// single scalar. The file input accepts `multiple`; each selected file is
// uploaded one at a time (the endpoint only takes one file per request) and
// appended to the list in selection order as each upload resolves — so a
// failure partway through a multi-file batch keeps whatever already
// succeeded instead of discarding the whole batch (mirrors ImageField's
// single-file error handling, just accumulated).
//
// Order in `value` IS display order (the guest gallery reads photos[0] as
// primary — see backend DrinkAdminOut.photo) — so each thumbnail gets
// Up/Down reorder controls plus Remove, no drag-and-drop library needed for
// this small a list.
export function MultiImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label?: string
  value: string[]
  onChange: (urls: string[]) => void
  hint?: React.ReactNode
}) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFiles(files: File[]) {
    setUploading(true)
    setError(null)
    // Accumulate locally (not via the `value` prop) across awaits — the
    // prop only reflects the latest committed state once the parent
    // re-renders, so chaining off it inside this loop would drop every
    // upload but the last.
    let next = value
    try {
      for (const file of files) {
        const { url } = await adminApi.uploadImage(file)
        next = [...next, url]
        onChange(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файл")
    } finally {
      setUploading(false)
    }
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="font-mono text-[10px] tracking-[0.06em] text-[#52525B]">{label}</span>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="flex flex-col items-center gap-1">
              <img
                src={resolveImageUrl(url)}
                alt=""
                className="size-16 shrink-0 rounded-lg border border-input object-cover"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Переместить раньше"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="size-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  aria-label="Переместить позже"
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="size-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Убрать фото"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Загрузка…" : value.length ? "Добавить ещё" : "Загрузить"}
        </Button>
      </div>

      {error ? (
        <span className="font-mono text-[10px] text-destructive">{error}</span>
      ) : (
        <FieldHint>{hint}</FieldHint>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (files.length) void handleFiles(files)
        }}
      />
    </div>
  )
}
