# Brand assets (vector sources)

These SVGs are the **sources**. They are NOT served (they live outside `public/`)
because each is ~350 KB of coat-of-arms path detail — too heavy to ship to the
browser. The served assets in `frontend/public/` are rasterized from these.

- `app-icon.svg` — square coat-of-arms on red (favicon / PWA / apple-touch icon).
- `logo.svg` — horizontal "UNIVERSITY OF KOLLEKTIV" lockup (the in-app logo).

## Regenerate the served assets (ImageMagick + librsvg)

Run from `frontend/`:

```bash
# App/favicon icons from app-icon.svg
magick -background none brand/app-icon.svg -resize 512x512 public/pwa-512.png
magick public/pwa-512.png -resize 192x192 public/pwa-192.png
magick public/pwa-512.png -resize 180x180 -background white -flatten public/apple-touch-icon.png
magick public/pwa-512.png -resize 32x32 public/favicon-32.png
magick public/pwa-512.png -resize 16x16 public/favicon-16.png

# In-app logo (height 120 ≈ 2x+ the 56px login hero; crisp, ~90 KB)
magick -background none brand/logo.svg -resize x120 public/logo.png
```

Referenced by: `index.html` (favicon/apple-touch links), `public/manifest.webmanifest`
(`icons[]`), and `logo.png` by `src/auth/LoginPage.tsx` + `src/pages/cocktail-guide/shell.tsx`.
