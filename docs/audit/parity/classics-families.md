# Data-parity audit — Classics + Families

**6 findings: 1 high / 2 medium / 3 low**

Scope: old `classics` (67 rows) + `families` (9 rows) tables, their link tables
(`classic_spirits`, `classic_descriptors`, `classic_related_cocktails`), old
rendering (`ClassicsPage.jsx`, `ClassicCard.jsx`, `ClassicSheet.jsx`,
`ProgressPanel.jsx`, branch `main`) vs new (`backend/app/routers/content.py`,
`frontend/src/data/mapBundle.ts`, `frontend/src/pages/cocktail-guide/{views,detail-sheet,team-view}.tsx`).

Method: full row-for-row DB diff of `classics`/`families`/`classic_spirits`/
`classic_descriptors`/`classic_related_cocktails` between `SRC_DATABASE_URL`
(prod) and `DEST_DATABASE_URL` (new), plus code trace of every field through
`load.py` → `models.py` → `content.py` → `bundle.json` → `mapBundle.ts` → kit
render.

## Findings

| id | field | old location | new location | class | sev | example | fix |
|---|---|---|---|---|---|---|---|
| CF-1 | Classics search (descriptors + origin) | `ClassicsPage.jsx`: `list.filter(c => name.includes(q) \|\| descriptors.some(d=>d.includes(q)) \|\| origin.includes(q))` | `views.tsx` `ClassicsView`: `base = CLASSICS.filter(c => q==="" \|\| c.name.toLowerCase().includes(q...))` — **name only** | RENDER-GAP (behavior) | **HIGH** | Searching `кислый` in old matched Gimlet (descriptor "Кислый"); in new UI it returns 0 results (name "Gimlet" doesn't contain it). Same for origin: searching `Португа` (matches `porto_sour`'s origin "Португалия") returns 0 in new UI. Data (`descriptors`, `city`) is present in the bundle already — it's just not wired into the search predicate. | In `ClassicsView`'s filter, extend the predicate to also check `c.descriptors.some(d=>d.toLowerCase().includes(q))` and `c.city.toLowerCase().includes(q)`, matching old behavior. |
| CF-2 | `families.color` (hex) | Rendered directly: `ClassicsPage.jsx` family-theory block `borderLeftColor: activeFamilyObj.color`; `ProgressPanel.jsx` family name text + bar fill `style={{color: f.color}}` / `background: f.color` | `Family` model has `color` (migrated, byte-identical: confirmed `#4e7a4e`…`#8a6b2d` for all 9 rows in both DBs) but `FamilyOut` (schemas.py) has **no `color` field at all** — `content.py`'s `_serialize`... (bundle builder) never reads `f.color`. New UI substitutes a fixed per-tint CSS var (`--tint-sour` etc. in `tint-marker.tsx`), rendered only as an 8–10px square marker, not a border wash / full-width bar fill. | STRANDED + RENDER-GAP | MED | `GET /api/content` families entries have `tint:"negroni", code:"NEGRONI", title:"Negroni & Friends"` but no `color` key; DB `families.color='#c0392b'` for that row is present but unreachable via the API. | Either add `color: f.color` to `FamilyOut`/bundle so future admin edits to family color have somewhere to land, or explicitly drop the DB column and document that per-family color is now a design-system constant (avoid a permanently-dead DB field). |
| CF-3 | Classics FAMILY filter-pill labels | `ClassicsPage.jsx`: `FAMILY_FILTERS = families.map(f => ({key:f.key,label:f.label}))` — pills show the real DB label ("Negroni & Friends", "Martini / Martinez", "Highball & Co.", "Spritz & Bubbles") | `views.tsx` `ClassicsView`: `familyOpts = FAMILIES.map(f => ({label: cap(f.code), tint: f.tint}))` — pill label is `cap("NEGRONI")` = `"Negroni"`, not `f.title` | RENDER-GAP (truncation) | LOW/MED | Bundle already carries `title:"Negroni & Friends"` (used correctly elsewhere: `FamilyGroupHeader`, `FamilyTheory`, `ClassicDetail`'s `famLine`) — only the top filter-pill row ignores it. Affects 4/9 families (negroni, martini, highball, spritz); sour/daisy/mary/manhattan/dessert are single-word so `cap(code)` happens to match. | In `views.tsx`'s `familyOpts`, use `f.title` instead of `cap(f.code)`. |
| CF-4 | Classic `year`/`city` (origin) blank handling | `ClassicCard.jsx`/`ClassicSheet.jsx` conditionally render: `{classic.year && <span>…}`, `{classic.origin && <span>…}` — omitted entirely when empty | `detail-sheet.tsx` `subMeta`: `{c.year} · {c.city.toUpperCase()} · {c.glass.toUpperCase()}` and `views.tsx` `ClassicRow`: `{c.year} · {c.city}` — always interpolated, no truthiness guard | FORMAT | LOW/MED | 18/67 classics have `origin IS NULL` (e.g. `gibson`, `aztec_negroni`, `dry_manhattan`, `mezcal_margarita`…) and 2/67 have `year IS NULL` (`coch_el_tommys`, `porto_sour`). `gibson`'s detail sheet renders `"1908 ·  · КОКТЕЙЛЬНАЯ РЮМКА"` (dangling double-dot); `coch_el_tommys` renders `" ·  · <glass>"` (both leading pieces blank). | Build the meta line by filtering falsy parts and joining with `" · "` (same pattern already used for `Meta`/cocktail meta in the same file), instead of unconditional template interpolation. |
| CF-5 | `families.sub` (subtitle) | Never rendered on any public page — only editable via `FamilyEditor.jsx`'s "Подзаголовок" field (admin-only) | Migrated byte-identical into new DB (`families.sub`), but `FamilyOut` has no `sub` field — completely absent from the bundle | STRANDED | LOW | No user-visible regression (it was never shown before either), but if/when Phase-1 admin CRUD for families is rebuilt, there's nowhere for this column's value to surface via the current bundle contract. | Decide: either wire `sub` through `FamilyOut` for a future admin/detail use, or drop the column — currently a fully dead field end-to-end. |
| CF-6 | Classic → multiple spirits | `classics.spirits: string[]` (all `classic_spirits` rows); old UI itself only ever showed `spirits[0]` on the card, but the **filter** matched `classic.spirits.includes(activeSpirit)` against the full array | `ClassicOut.spirit: str = ""` — `_serialize_classic`: `c.spirits[0].spirit.label if c.spirits else ""`. No `spirits: list[str]` field exists for classics (unlike `DrinkOut.spirits`) | FORMAT (latent) | LOW | Currently **no live impact**: verified `classic_spirits` has exactly 67 rows for 67 classics (1:1, no classic with 0 or ≥2 spirit tags), so `spirit[0]` and "the full set" are identical today. But the new schema/serializer can only ever represent one spirit per classic — a future editorial addition of a second spirit tag to a classic would be silently truncated to the first (by sort_order), with no code path to notice. | Low priority given current data; if classics ever need >1 spirit tag, add a `spirits: list[str]` to `ClassicOut` mirroring `DrinkOut`. |

## Already-known finding (out of scope for this domain)

Confirmed the shared "Авторские lost their base spirit" issue does **not** apply
to classics — `classic_spirits`/`ClassicSpirit` is populated correctly by
`load.py` step 8 and fully reaches the bundle as `classics[].spirit`.

## Verified as OK (no action needed)

- **`classics` table, all 67 rows, all columns** (`slug`, `name`, `family_id`,
  `year`, `origin`, `composition`, `glass_id`, `garnish`, `history`,
  `for_whom`, `sort_order`): byte-for-byte identical between prod and new DB
  (scripted diff, 0 mismatches). `glass_id` is non-null for all 67 rows in
  prod, so the "no rescue path" gap for `classic.glass_label_override` never
  actually loses data — **confirmed 0/67 rows have a non-blank
  `glass_label_override` in prod**, matching `load.py`'s own logged assertion
  ("classics glass_label_override: 0 non-empty").
- **`classic_spirits`** (67/67 rows, 1 spirit per classic, no gaps) → renders
  correctly as the spirit chip/filter (see CF-6 caveat above).
- **`classic_descriptors`** (217/217 rows preserved) → all descriptors reach
  the bundle and are rendered in full on both the card (`ClassicRow`) and
  detail sheet (`ClassicDetail`) — actually an improvement over old, which
  truncated the card to the first 2 descriptors.
- **`classic_related_cocktails`** (17/17 rows) → explicitly re-verified the
  audit brief's flagged Upcykle-dedup concern: every one of the 17
  prod rows resolves, by name, to the correct surviving `Drink` row in the new
  DB (e.g. `gimlet`→{Braindead, Gentle Cloud, Jjang!, Springer},
  `whiskey_sour`→Big Apple). No orphaned/dropped links. The theoretical risk
  in `load.py` (`ck_slug` built only from `src["cocktails"]`) turns out not to
  be a real exposure: `classic_related_cocktails.cocktail_id` is FK'd only to
  the `cocktails` table in prod (never `zero_cocktails`/`zc_drinks`), so the
  Upcykle-merge dedup logic in step 4 can never affect it.
- **`families`** (9/9 rows, all columns incl. `sub`/`color`) → migrated
  byte-identical (see CF-2/CF-5 for the two columns not reachable via the
  bundle). `logic`/`evolution`/`tip` all render, and the new "grouped by
  family" Классика view + per-family theory card is a superset of old
  (old only showed theory for one active family at a time; new also shows a
  collapsible theory block per group in "Все" mode). Per-family classic
  counts (`FamilyOut.total`) verified correct and sum to 67.
- **Classics-only progress panel** (old `ProgressPanel.jsx` → new
  `FamiliesPanel` in `team-view.tsx`): full parity, including the
  good/partial/none 3-level breakdown at the same 80%/40% thresholds, and the
  "Знаю"/"Не знаю" per-classic drill-down list with click-through to the
  detail sheet. New version is arguably better: it displays the qualitative
  level label text (ХОРОШО/ЧАСТИЧНО/НЕ ИЗУЧЕНО) that old code computed but
  never actually rendered (per `frontend-inventory.md` §1.4).
- **Cross-link ("Наш ответ")**: classic → author-cocktail cross-navigation
  preserved (`onCrossLink` in `page.tsx` opens the `Cocktail` sheet by
  `menuId`), same UX as old (`onOpenAuthorCocktail`).
