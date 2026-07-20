// Resolves a content image path to a loadable URL (parity with old prod's
// resolveImageUrl, frontend-inventory §1.17). All media now lives on the
// backend's uploads volume (served at /static/img/…), a different origin
// than the SPA, so every non-absolute path needs the backend origin
// (VITE_API_URL) prefixed. Two cases:
//   - absolute http(s) URL → as-is
//   - everything else (/static/img/…, and legacy /logos/… if any remain)
//     → prefix with BASE
const BASE = import.meta.env.VITE_API_URL ?? ""

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  return `${BASE}${url}`
}
