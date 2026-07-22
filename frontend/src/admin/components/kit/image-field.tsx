import * as React from "react"

import { resolveImageUrl } from "@/lib/img"
import { Button } from "@/components/ui/button"
import { FieldHint } from "./form"

import { adminApi } from "../../api"

// Kit-styled image upload (Phase-2). Same API as the old ImageUploadField
// ({label,value,onChange,hint}) and the same pipeline: file → adminApi.upload
// Image → the field stores only the returned `/static/img/…` url that every
// drink/spirit/kitchen `img`/`photo` column expects; preview via
// resolveImageUrl. Only the chrome is re-skinned to the kit (rounded-lg INK
// border thumb + kit Buttons + mono-caps label/hint).
export function ImageField({
  label,
  value,
  onChange,
  hint,
}: {
  label?: string
  value: string | null
  onChange: (url: string | null) => void
  hint?: React.ReactNode
}) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const { url } = await adminApi.uploadImage(file)
      onChange(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить файл")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="font-mono text-[10px] tracking-[0.06em] text-[#52525B]">{label}</span>
      )}
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={resolveImageUrl(value)}
            alt=""
            className="size-16 shrink-0 rounded-lg border border-input object-cover"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-input text-center font-mono text-[10px] leading-tight text-muted-foreground">
            нет фото
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Загрузка…" : value ? "Заменить" : "Загрузить"}
            </Button>
            {value && !uploading && (
              <Button type="button" variant="quiet" size="sm" onClick={() => onChange(null)}>
                Убрать
              </Button>
            )}
          </div>
          {error ? (
            <span className="font-mono text-[10px] text-destructive">{error}</span>
          ) : (
            <FieldHint>{hint}</FieldHint>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void handleFile(file)
        }}
      />
    </div>
  )
}
