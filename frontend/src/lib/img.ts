// Resolves a content image path to a loadable URL (parity with old prod's
// resolveImageUrl, frontend-inventory §1.17). Three cases:
//   - absolute http(s) URL        → as-is
//   - backend upload /static/...   → prefix the backend origin (VITE_API_URL);
//     these files live on the backend's uploads volume, a different origin
//     than the SPA, so a bare /static path would 404 against the frontend.
//   - everything else (/logos/...) → as-is: a same-origin frontend public asset.
const BASE = import.meta.env.VITE_API_URL ?? ""

export function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("/static/")) return `${BASE}${url}`
  return url
}
