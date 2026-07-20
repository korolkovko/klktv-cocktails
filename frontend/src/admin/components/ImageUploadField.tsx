import * as React from "react"

import { resolveImageUrl } from "@/lib/img"

import { adminApi } from "../api"

// File input -> adminApi.uploadImage -> preview via resolveImageUrl -> the
// field stores only the returned `url` (e.g. "/static/img/foo-ab12.webp"),
// same shape every drink/spirit/kitchen-dish `img`/`photo` column expects.
export function ImageUploadField({
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
    <div>
      {label && <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>}
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={resolveImageUrl(value)}
            alt=""
            className="size-16 shrink-0 rounded border border-gray-300 object-cover"
          />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 text-center text-[10px] leading-tight text-gray-400">
            нет фото
          </div>
        )}
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "Загрузка…" : value ? "Заменить" : "Загрузить"}
            </button>
            {value && !uploading && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Убрать
              </button>
            )}
          </div>
          {error ? (
            <span className="text-xs text-red-600">{error}</span>
          ) : hint ? (
            <span className="text-xs text-gray-400">{hint}</span>
          ) : null}
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
