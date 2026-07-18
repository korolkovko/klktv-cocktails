# Phase 1a Blueprint — rebuild `klktv-cocktails` backend API onto the v2 DB

Scope: auth + `/api/content` bundle + progress + operational/security cleanup.
Admin/editor CRUD (`admin.py`, `admin_users.py`, `uploads.py` write-path) is Phase 2 — disabled, not rewritten.
Read-only research; no code was changed to produce this document.

Sources read: `backend/app/models.py`, `backend/app/routers/{content,me,auth,admin,admin_users,uploads}.py`,
`backend/app/{schemas,auth,config,database,main}.py`, `backend/seed.py`, `backend/{Dockerfile,railway.json,pyproject.toml}`,
`backend/alembic/{env.py,versions/8d4ec3b4729d_v2_baseline_schema.py}`, `docs/audit/2026-07-19-current-system-audit.md`,
and the kit consumer block (`data.ts`, `views.tsx`, `detail-sheet.tsx`, `page.tsx`, `shell.tsx`).

---

## A. Target `/api/content` bundle shape

### A.0 Architecture decision: bundle is catalog-only, no per-user `learned` fields

`/api/content` should stay **user-agnostic content** (same payload for every logged-in user, cacheable).
All per-user state lives in `/api/me/progress` (Part B). Concretely this means:

- No individual `Drink`/`Classic`/`SpiritEntry`/`KitchenDish` gets a `learned: boolean` in the bundle.
- `Section.total` / `Family.total` are **true catalog counts** (not the kit's demo baseline numbers).
- `Section.learned` / `Family.learned` are **not sent by the backend at all** — the frontend computes them
  by intersecting the bundle's slug lists with the progress endpoint's slug lists. This is exactly what the
  kit's `sectionLearnedLive()` / `familyLearnedLive()` / `classicsLearnedLive()` / `totalLearnedLive()` helpers
  in `data.ts` already do, except today they reconcile against **hardcoded demo baselines**
  (`catalog − staticLearned(scope) + live(scope)`). Once wired to the real backend, that reconciliation
  arithmetic can be **deleted** — `learned = |slugsInScope ∩ progressSlugs|` is exact, no baseline needed,
  because the backend numbers are already ground truth (not an approximation of a locally-toggled demo state).
  Flag this simplification for whoever writes the glue/adapter layer.

### A.1 Sections

Source: `categories` table (`Category`: key, label, kind, sort_order, is_visible).

| kit `Section` field | source | notes |
|---|---|---|
| `id` | `category.key` | **must** be one of `menu\|classics\|spirits\|kitchen` in v2 (zero/zc merged away). If `categories` still has leftover `zero`/`zc` rows from the old seed, filter them out explicitly (`WHERE kind IN ('menu','classics','spirits','kitchen')`) rather than trusting the data. |
| `label` | `category.label` | direct |
| `total` | computed: `COUNT(*)` of the matching entity table (`drinks`, `classics`, `spirit_entries`, `kitchen_dishes`) | not a stored column |
| `learned` | **omit** (see A.0) | |

`categories.is_visible` is dead data per the audit (always `true` on all 6 rows) — filter on it defensively anyway (`WHERE is_visible`), it's a no-op today but free to keep.

### A.2 Drinks (`menu` / "Авторские") — unified alcoholic + non-alcoholic

Source: `Drink` + `drink_tags`/`drink_flavors`/`drink_spirits`/`drink_details` + `Glass`/`Badge` lookups.

| kit `Cocktail` field | source | computed? |
|---|---|---|
| `id` | `drink.slug` | |
| `name` | `drink.name` | |
| `logo` | `drink.img` | kit's "logo" = the MediaCard wordmark thumbnail; this is `img`, **not** `photo` |
| `subtitle` | `drink.subtitle` | |
| `price` | `drink.price_amount` (Numeric→number) | kit hardcodes the `₽` suffix in the UI; `price_currency` isn't rendered dynamically anywhere in the kit — fine while `price_currency` stays `"₽"` for every row, but flag if content ever needs another currency |
| `volume` | `drink.volume_ml` | |
| `abv` | `drink.abv` (Numeric→number) | `abv_raw` (free text) not surfaced to kit |
| `spirit` | first `drink_spirits` row (by `sort_order`) → `spirit.label` | **computed**: primary spirit = `spirits[0]` |
| `spirits` | all `drink_spirits` rows ordered by `sort_order` → `spirit.label[]` | direct list; kit itself falls back to `[spirit]` when this is absent, so it's safe to always populate it explicitly rather than omit for single-spirit drinks |
| `glass` | `drink.glass.label` (via `glass_id`) | v2 dropped the old `glass_label_override` free-text fallback entirely — if `glass_id` is null there is **no** fallback text field on `Drink`; kit's `glass: string` is non-optional, so a null glass renders as an empty string. This is a content-completeness question (every drink should have a glass assigned), not a backend bug. |
| `descriptors` | **computed**: `[s.label.upper() for s in drink_spirits ordered] + [f.label.upper() for f in drink_flavors ordered]` | see rationale below |
| `badge` | `drink.badge.key` (uppercased) if `badge_id` set, else `undefined` | **format change from v1**: kit's `MenuBadge` is a bare string (`"HOT"`/`"BOTTLED"`/`"PREMIUM"`/`"ONESIP"`), not the old `{key,label}` object — `views.tsx` uses `c.badge` directly as the chip label text. Confirm `badges.key` values in the v2 DB are exactly these 4 uppercase tokens (data check, not code). |
| `recipe` | `drink.recipe` | direct 1:1, name matches |
| `garnish` | `drink.garnish` | direct |
| `pitch` | `drink.pitch` | direct |
| `photo` | `drink.photo` | direct — distinct column from `img`/`logo`, both exist in the model |
| `about` | `drink.about` | direct |
| `naming` | `drink.naming` | direct |
| `faq` | `drink.faq` | direct |

**`descriptors` rationale**: kit's demo data bakes the spirit name(s) as the *first* entries of `descriptors`
(e.g. `spirit: "Джин"`, `descriptors: ["ДЖИН","ЦИТРУС","ИМБИРЬ","ХВОЯ"]`; multi-spirit example `gentle-cloud` has
`spirits: ["Соджу","Джин"]`, `descriptors: ["СОДЖУ","ДЖИН","КИСЛО-СЛАДКИЙ","МАЛИНА","КЛУБНИКА"]`). `detail-sheet.tsx`'s
`FlavorChips` computes `strong = spirits.map(upper)` and then filters `descriptors` to drop anything already in
`strong` — i.e. the **source** `descriptors` array is expected to already contain spirits + flavor words combined;
the component only dedups for its own strong/muted chip split. `MediaCard` (in `views.tsx`) just takes
`descriptors.slice(0,3)` raw, so leading with the spirit is intentional (shows spirit + top 2 flavor notes on the card).
Recommended backend contract: always emit `descriptors = spirits(upper) + flavors(upper)`, both taken from the M:N
tables, no separate DB column needed.

**`drink_tags` (`Tag` lookup) has no direct kit consumer.** Neither `MenuView`'s filters (`SPIRIT_FILTERS`/`GLASS_FILTERS`,
matched by `c.spirit`/`c.glass` strings) nor `detail-sheet.tsx` read anything called `tags`. Recommend **not** serializing
`tags` into the bundle for 1a (dead weight matching what the kit actually needs); keep the table for a future
admin/search feature.

**`drink_details` (generic `label`/`text` list) has no kit consumer at all.** The v1 flexible detail-list design was
replaced by the six named text columns (`recipe/garnish/pitch/about/naming/faq`) that map 1:1 to kit's fixed
`<Section title="…">` blocks in `detail-sheet.tsx`. `drink_details` rows are a v1 holdover with nowhere to render in
the new UI. Recommend dropping `drink_details` from the bundle entirely for 1a; if any drink's story content still
only lives in generic detail rows (not yet backfilled into the named columns), that content is **silently invisible**
in the new frontend until content is migrated — flag as an ETL/content follow-up, not a code fix.

**Kit-side gap (reverse direction) — `is_alcoholic`/`is_zero_culture`/`caffeine_level`/`is_carbonated` exist on
`Drink` but have *no* field at all on the kit's `Cocktail` TS type**, and `MenuView`/`MediaCard` don't branch on
alcoholic-vs-not anywhere (no "0% ABV" styling, no caffeine/carbonation display, no visual distinction for the
merged former zero/zc items). This is the single biggest structural gap between the v2 DB shape and the kit as
given: the "merge zero+zc into Авторские" product decision post-dates (or wasn't fed back into) this kit block.
**Recommendation:** still include `is_alcoholic`, `is_zero_culture`, `caffeine_level`, `is_carbonated` in the bundle
response now (cheap, forward-compatible) even though the current kit TS types/components ignore them — the frontend
team will need a small, separate kit-extension task (add the fields to `Cocktail`, add a "0%"/zero badge, decide
whether to keep or remove the vestigial `zero`/`zc` nav entries in `shell.tsx`/`page.tsx`) before those items read
correctly in the UI. That extension is frontend work, out of backend scope, but shouldn't require a second backend
round-trip if the fields are already in the payload.

### A.3 Classics

Source: `Classic` + `classic_spirits`/`classic_descriptors`/`classic_related_drinks` + `Family`/`Glass` lookups.

| kit `Classic` field | source | notes |
|---|---|---|
| `id` | `classic.slug` | |
| `name` | `classic.name` | |
| `year` | `classic.year` (Integer) → `str(year)` | **gap**: kit's `year` is a free-text string that also holds decade notation (`"1860-е"`, `"1870-е"` in the demo data). `classics.year` is a strict `Integer` with no accompanying `year_raw`/text column (unlike `Drink`, which has `abv_raw`/`price_raw` etc.). Exact years serialize fine (`str(1919)` → `"1919"`); decade-style content cannot round-trip through an `Integer` column. Either accept lossy exact-year rounding for 1a, or add a `year_raw`/`year_label` text column later if the content team needs approximate-year framing. |
| `city` | `classic.origin` | **name differs**: kit `city` = model `origin` |
| `family` | `classic.family.key` | must be one of the 9 `TintName` values — see A.4 |
| `spirit` | first `classic_spirits` row (by `sort_order`) → `spirit.label` | **gap**: DB supports M:N (multiple spirits/classic), kit's `Classic` type has only one `spirit: string` (unlike `Cocktail`, which also has a `spirits?: string[]` overflow field). Any 2nd+ spirit on a classic is silently dropped from the UI (not from the DB) — computed as `spirits[0]`. |
| `glass` | `classic.glass.label` | same null-glass caveat as A.2 |
| `descriptors` | `classic.descriptors` (via `classic_descriptors` → `Descriptor.label`, ordered) | **direct 1:1** — unlike drinks, classics have their own dedicated `Descriptor` lookup, no computation needed |
| `recipe` | `classic.composition` | **name differs**: kit `recipe` = model `composition` (the proportions/method text, e.g. `"Джин 30 · кампари 30 · красный вермут 30. Стир…"`) |
| `garnish` | `classic.garnish` | direct |
| `history` | `classic.history` | direct |
| `fits` | `classic.for_whom` | **name differs** (given in task prompt too) |
| `ourAnswers` | computed from `classic_related_drinks` → `Drink` | see below |

**`ourAnswers` gap**: kit demo shows entries like
`{ label: "Мезкаль Негрони", menuId: "braindead" }` and `{ label: "Андрессд Негрони" }` (no `menuId` at all — a
free-standing mention with no linked drink). Two problems mapping this onto `classic_related_drinks`:
1. The join table only has `classic_id`/`drink_id`/`sort_order` — **no label column**. The kit's `label` is clearly
   an editorial *twist name* ("Мезкаль Негрони"), not the drink's actual product name ("БрэйнДэд"). Serializing
   `label = drink.name` is the only thing possible today and is lossy (loses the "framed as a twist on X" phrasing).
2. Entries with no `menuId` (just a text mention, no real linked drink) **cannot be represented** — every row in
   `classic_related_drinks` requires a real `drink_id`.

Recommendation for 1a: serialize what's representable — `ourAnswers = [{label: d.name, menuId: d.slug} for d in related_drinks ordered]` — and treat unlinked/custom-label mentions as a Phase 2 schema addition (`label` text column, nullable `drink_id`) if the content team wants that flexibility; don't block 1a on it.

### A.4 Families

Source: `Family` table.

| kit `Family` field | source | notes |
|---|---|---|
| `tint` | `family.key` | **must be exactly one of** `sour\|daisy\|mary\|negroni\|martini\|manhattan\|highball\|spritz\|dessert` — `TintMarker` maps this to a **fixed design-system color token**, not an arbitrary color. Verify this at the data level before wiring the bundle. |
| `code` | not stored — kit computes it as `tint.toUpperCase()` in the frontend (`ClassicsView`: `cap(f.code)`, filter matching `f.code === family.toUpperCase()`) | no backend field needed; if included for convenience, must equal `key.upper()` |
| `title` | `family.label` | kit demo shows an English mono-style title (`"NEGRONI & FRIENDS"`); real content will just be whatever `label` holds |
| `logic` | `family.logic` | direct |
| `evolution` | `family.evolution` | direct, optional |
| `tip` | `family.tip` | direct, optional |
| `learned`/`total` | **omit** (see A.0); `total` derivable client-side as count of classics with that `family_id`, or returned as a computed field if convenient | |

`family.sub` and `family.color` have **no consumer in the kit at all**. `color` was very likely read directly as
an inline CSS color by the old (pre-kit) v1 frontend; the new kit's `TintMarker` uses its own internal
tint→color mapping keyed off the 9 fixed `tint` strings, ignoring any stored color value. Treat both as dead
weight for 1a (harmless to still serialize, but don't invest in them).

### A.5 Spirits (grouped by category)

Source: `SpiritCategory` + `SpiritEntry`.

Kit's own `data.ts` stores spirits **pre-grouped** (`SPIRIT_GROUPS: {category, total, items}[]`), unlike Classics
(flat `CLASSICS` + flat `FAMILIES`, grouped by the *component* at render time). Recommend the backend still returns
**flat** parallel resources — `spirit_categories` + `spirit_entries` (each entry carrying its `category_slug`) —
matching the existing v1 endpoint shape and REST convention; the frontend adapter groups `spirit_entries` by
`category_slug` into the `SpiritGroup[]` shape the kit expects. This is the same, already-precedented grouping
step `ClassicsView` performs inline for classics/families — cheap, not a backend requirement.

| kit `Spirit` field | source | notes |
|---|---|---|
| `name` | `spirit_entry.name` | |
| `meta` | **no structured source** | see gap below |
| `abv` | `spirit_entry.abv` (Numeric→number) | `abv_raw` not surfaced |
| `country` | `spirit_entry.country` | direct |
| `region` | **no source column at all** | `spirit_entries` has only `country`, no `region`. Will be `null`/omitted until a `region` column is added. (The old schema's messy `country` field sometimes had `"регион:Испания"`-style garbage per the audit — do **not** try to parse region out of `country` as a stopgap, it'll re-introduce that mess.) |
| `flavour` | `spirit_entry.flavour` | direct, name matches |
| `brand` | `spirit_entry.brand` | direct, short name (e.g. `"Diageo"`) |
| `brandDetail` | **inferred**: `spirit_entry.description` | `description` is otherwise unreferenced by any kit field — the most plausible mapping is the long "about the brand" paragraph kit calls `brandDetail`, but the name doesn't match; confirm with content team before committing to this mapping |
| `features` | `spirit_entry.features` | direct |
| `pairings` | `spirit_entry.cocktail_pairings` | **name differs, and this is the exact bug the audit already flagged** (audit item 18: "Секция спирита «В коктейлях» не рендерится из-за рассинхрона поля (`cocktail_pairings` vs `cocktailPairings`)"). Serialize the bundle key as `pairings` (matching kit exactly) — don't repeat the snake/camel mismatch. |
| `fact` | `spirit_entry.fact` | direct |
| `sourceUrl` | `spirit_entry.source_url` | name differs (snake vs camel) — same class of bug as `pairings`, be deliberate about the JSON key |
| `img` | `spirit_entry.img` | direct |
| `learned` | **omit** (Part B) | key format `category:name` — see B |

**`meta` gap**: kit shows short signature strings like `"ЛОНДОН ДРАЙ · 43.1%"`, `"ШВАРЦВАЛЬД · 47 БОТАНИКАЛОВ · 47%"`,
`"АЙЛА · ТОРФ · 40%"` — a hand-picked 1–2 word style/region tag plus ABV%. Nothing in `spirit_entries` stores this
short tag separately from the long-form `flavour` prose. Options: (a) compute a generic fallback for 1a, e.g.
`f"{country.upper()} · {abv}% ABV"` or just `f"{abv}% ABV"`, losing the crafted brevity; (b) add a short
`style_tag`/`region` column later; (c) have the content team hand-author a `meta` string per entry. Flag for the
plan author — this is a content-authoring decision, not something the backend can derive.

`spirit_entries.price_amount/price_currency/serving_ml/price_raw` and `spirit_categories.is_archived` have no
consumer in the given kit's detail/list views (the "Выведенные"/retired tab renders a static placeholder message,
"Архив в проде" — not real entries). Bundle only needs enough to compute a retired **count**
(`SUM(count(entries)) WHERE category.is_archived`), matching kit's `RETIRED_COUNT`; a real retired-browsing UI is
out of scope for 1a.

`SPIRIT_CATEGORIES` filter list (`["Все","Джин","Виски","Агава","Ром"]`): recommend deriving as
`DISTINCT spirit_categories.label WHERE NOT is_archived AND has entries`, ordered by `sort_order`, rather than
hardcoding — avoids the "mirrors previous JS, easier to hardcode" staleness trap the v1 code explicitly called out
(`content.py:24-26`).

### A.6 Kitchen (dishes by category)

Source: `KitchenCategory` + `KitchenDish`.

Kit stores kitchen **flat** (`KITCHEN_CATEGORIES: {code,total}[]` + `DISHES: Dish[]`, each dish carrying a
`category: string` matched against `KITCHEN_CATEGORIES.code` by `KitchenView`) — same flat pattern as
Classics/Families. Backend should return flat `kitchen_categories` + `kitchen_dishes` (each dish with
`category_slug`), matching this pattern directly (no grouping needed by either side beyond what `KitchenView`
already does).

| kit `Dish` field | source | notes |
|---|---|---|
| `id` | `kitchen_dish.slug` | |
| `name` | `kitchen_dish.name` | |
| `category` | `kitchen_category.label` | dish's own field is `category_slug` (FK); the display string is the category's `label` |
| `subtitle` | `kitchen_dish.tagline` | **name differs** |
| `price` | `kitchen_dish.price_amount` (Numeric→number) | |
| `weight` | `kitchen_dish.weight_g` | direct (single int), `weight_raw` not surfaced |
| `timing` | **computed** from `timing_min_low`/`timing_min_high` | **gap**: kit wants a single number, model stores a range. Recommend the midpoint (rounded) or the low bound; keep `timing_raw` available server-side for provenance, just don't put it in the bundle |
| `photo` | `kitchen_dish.img` | **name differs**: kit `photo` = model `img` |
| `description` | `kitchen_dish.description` | direct |
| `serving` | `kitchen_dish.serving` | direct |
| `fact` | `kitchen_dish.interesting_facts` | **name differs** |
| `allergens` | **no source column at all** | `kitchen_dishes` has no allergens/stop-list field whatsoever. Will be `null`/omitted for every dish until a dedicated column is added — this is a missing column, not a naming mismatch. |
| `nutrition` | computed `{kcal: kcal_portion, protein: protein_g, fat: fat_g, carb: carb_g}` (Numeric→number, rounded) | `kcal_100g` and `nutrition_raw` have no slot in kit's `DishNutrition` type — omit from bundle or keep server-side only |
| `learned` | **omit** (Part B) | |

### A.7 Filter lists

| kit list | recommended source | notes |
|---|---|---|
| `SPIRIT_FILTERS` (menu) | `DISTINCT spirits.label` used by any `drink_spirits`, ordered by `spirits.sort_order`, "Все" prepended | v1 hardcoded this (`COCKTAIL_SPIRIT_FILTERS`, `content.py:27-35`); recommend deriving dynamically to avoid drift as new spirits/drinks are added |
| `GLASS_FILTERS` (menu) | `DISTINCT glasses.label` used by any drink, ordered by `sort_order` | same reasoning; v1 hardcoded (`COCKTAIL_GLASS_FILTERS`, `content.py:36-46`) |
| `CLASSIC_SPIRITS` | `DISTINCT spirits.label` used by any `classic_spirits`, ordered by `sort_order` | separate list from the menu one — classics and drinks draw from the same `spirits` lookup but use different subsets |
| `SPIRIT_CATEGORIES` (encyclopedia section) | see A.5 | |

All four lists are string arrays with an implicit `"Все"`/"All" sentinel the kit hardcodes client-side as the
first filter option — the bundle doesn't need to include that sentinel itself, just the real values.

### A.8 Not in the bundle for 1a

- `timeline_entries` — model comment says "retained; not surfaced yet." Kit's `data.ts` has no timeline
  type/consumer at all (matches audit open decision #2: "История/таймлайн — делаем раздел или отказываемся?").
  Drop from the bundle; revisit if/when a "История" section is built.
- Per-item `learned` — see A.0.
- `drink_tags`, `drink_details`, `family.sub`, `family.color`, `kcal_100g`/`nutrition_raw` — see notes above; keep
  the columns, don't ship them in the bundle.

---

## B. Progress API contract

Router: `backend/app/routers/me.py`, prefix `/api/me`. Keep the existing shape, adjust `KIND_MODELS` and drop the
zero/zc kinds and the legacy classics-only shortcut routes (see Part C).

### Endpoints

- `GET /api/me/progress` → `dict[str, list[str]]`, one key per kind, **exactly** `{"menu": [...], "classics": [...], "spirits": [...], "kitchen": [...]}` (empty kinds still present as `[]`). Matches `models.py`'s own comment: `kind in menu/classics/spirits/kitchen`.
- `POST /api/me/progress/{kind}/{slug}` → `204`. Validates `kind` against the 4 allowed values, validates the entity exists (`Model.slug == slug` lookup against the right table), upserts `(user_id, kind, slug)` into `learning_progress`.
- `DELETE /api/me/progress/{kind}/{slug}` → `204`. Unconditional delete, already idempotent.
- **Drop**: the hidden legacy `POST/DELETE /api/me/progress/{slug}` shortcut (`me.py:100-117`) that aliases to `kind="classics"`. It exists for backward compat with a pre-`learning_progress`, classics-only progress API (`classic_progress` table) that **doesn't exist in the v2 schema at all** (it's not in `models.py`, and the audit explicitly says to delete the dead table + its migration). Nothing in the kit calls this shortcut form; it's dead weight.

### `kind` values and slug semantics

| kind | entity table | slug = | notes |
|---|---|---|---|
| `menu` | `Drink` | `drink.slug` | covers both alcoholic and merged non-alcoholic items |
| `classics` | `Classic` | `classic.slug` | |
| `kitchen` | `KitchenDish` | `kitchen_dish.slug` | |
| `spirits` | `SpiritEntry` | **see below** | |

### Spirits learned key: `category:name`

The kit's internal `Set<string>` for spirits progress is keyed as `` `${category.label}:${spirit.name}` `` —
built explicitly in `data.ts` (`sectionLearnedLive`'s spirits branch: `` `${g.category}:${s.name}` ``) and
`page.tsx` (`spiritKey = ${spiritCat}:${spirit.name}`). This is a **display-label composite key**, not a stable
identifier — if an editor ever renames a spirit category or a spirit entry, every progress row keyed on the old
label pair silently orphans. This is the exact same failure mode the audit flags as **HIGH-2** for classics
(slug rename orphans `learning_progress`), except here it's baked into a *label*, which is even more likely to
change than a slug.

**Recommendation**: keep the backend's persisted identity for the `spirits` kind as `spirit_entries.slug` (stable,
already exists, immune to relabeling) — do **not** store the raw `"ДЖИН:Танкерей"` string in `learning_progress.slug`.
Instead, have the **frontend adapter** (the thin glue layer that turns the `/api/content` bundle into kit props —
not the kit files themselves, which are given/fixed) maintain a `Map<compositeKey, realSlug>` built from the
bundle response (each spirit entry already carries both its `slug` and its `category_slug`/`category.label`):

- **Building the initial learned set**: fetch `/api/me/progress` → take `progress.spirits` (a list of real
  `spirit_entries.slug` values) → for each, look up its category label + name from the bundle → compute
  `` `${category}:${name}` `` → add that composite key to the `Set<string>` handed to the kit's `learned` state
  (replacing `initialLearned()`'s current hardcoded read of `SPIRIT_GROUPS[].items[].learned`).
- **On toggle**: kit calls `onToggle(compositeKey)` → adapter reverses the lookup (`compositeKey → realSlug`) →
  calls `POST`/`DELETE /api/me/progress/spirits/{realSlug}`.

This keeps backend persistence on a durable key while the kit code (unmodified) keeps operating on its
already-designed composite-key `Set<string>`. Document this translation step explicitly for whoever writes the
adapter — it's the one place where "learned key ≠ persisted slug."

### Deriving the frontend's initial-learned set (all sections)

Replace `page.tsx`'s `initialLearned()` (which currently reads `.learned` booleans off the static demo arrays)
with: fetch `/api/me/progress` once → union of:
- `progress.menu` slugs as-is (drink slugs)
- `progress.classics` slugs as-is
- `progress.kitchen` slugs as-is
- `progress.spirits` slugs translated to composite keys via the bundle lookup (above)

into the single `Set<string>` passed as `learned`/`learnedIds`/`learnedKeys` throughout `page.tsx`/`views.tsx`.

### Known bug to fix while touching `mark_learned`

`me.py:71-81`'s check-then-insert (`existing = query(...).first(); if not existing: db.add(...)`) has a race:
two concurrent `POST`s for the same `(user, kind, slug)` both pass the existence check, then one insert hits the
composite primary key and raises `IntegrityError` → unhandled → `500`. Audit item 8 already flags this
("mark_learned без upsert (гонка → 500)"). Fix with a real upsert
(`sqlalchemy.dialects.postgresql.insert(...).on_conflict_do_nothing()` on `(user_id, kind, slug)`), not a bigger
transaction or a retry loop.

---

## C. Cleanup checklist (file:line anchors)

Ordered roughly the way a PR series would land them; each bullet references the **current** file/line so the
plan author can jump straight to it.

### `app/database.py`

- **Delete** `_COLUMN_MIGRATIONS` (lines 25-33) entirely. These `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
  statements target **v1 tables** (`zc_drinks`, `kitchen_dishes.price`, `spirit_entries.brand/country/source_url`
  as loose text columns) that don't match the v2 schema's typed columns at all — running them against the v2 DB
  is either a no-op (columns already exist with different types) or actively wrong. Alembic
  (`alembic/versions/8d4ec3b4729d_v2_baseline_schema.py`) is now the single source of truth for schema.
- **Delete** `_DATA_MIGRATIONS` (lines 35-46) entirely. It inserts from `classic_progress` into
  `learning_progress`; `classic_progress` doesn't exist in `models.py`/the v2 schema, so this would just throw
  and get silently swallowed by its own `try/except` (line 56-60) — dead code that only ever prints a warning.
- **Delete** `Base.metadata.create_all(bind=engine)` (line 51) — Alembic owns table creation now; calling
  `create_all` alongside Alembic risks masking a missing/out-of-sync migration.
- **Net result**: `init_db()` (lines 49-61) should be removed entirely, or reduced to nothing meaningful — there's
  no boot-time DB setup left to do. Remove its call site in `main.py` (see below). If a lightweight "is the DB
  actually reachable" check is wanted, put it in `/health` (see `main.py`), not in a boot-time function.

### `app/config.py`

- Line 3: `SECRET_KEY = os.environ.get("SECRET_KEY", "klktv-cocktails-dev-secret-change-in-prod")` — **remove the
  default**, fail fast (`os.environ["SECRET_KEY"]`, or an explicit check-and-raise with a clear startup error).
  This is audit **C-2** ("Захардкоженный fallback SECRET_KEY … любой подделывает админ-токен публичным ключом из
  репо").
- Line 4: `DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/klktv_cocktails")`
  — same treatment, required no default (the app must point at the migrated v2 DB, never silently fall back to a
  local placeholder).
- Lines 16-17 (`SRC_DATABASE_URL`/`DEST_DATABASE_URL`): these are ETL-only settings used by `backend/migration/*`,
  not by the running API. Consider moving them out of the app's shared `config.py` into the migration script's own
  config so the live API's config module doesn't carry migration-only concerns. Optional, low priority.
- Add a `DEBUG`/`ENV` flag (e.g. `DEBUG = os.environ.get("DEBUG", "false").lower() == "true"`) — needed by
  `main.py`'s Swagger-gating change below.

### `app/main.py`

- Line 14: `from app.routers import admin, admin_users, auth, content, me, uploads` → drop `admin`, `admin_users`,
  `uploads` from the import (Phase 2).
- Lines 19-23 (`lifespan`): remove the `init_db()` call (line 21). Keep `UPLOAD_DIR.mkdir(...)` only if the static
  mount below is kept (read-serving already-migrated images).
- Line 26: `app = FastAPI(title=..., docs_url="/api/docs", lifespan=lifespan)` — gate docs behind `DEBUG`:
  `docs_url="/api/docs" if DEBUG else None, redoc_url="/api/redoc" if DEBUG else None, openapi_url="/api/openapi.json" if DEBUG else None`.
  Audit priority list explicitly calls for "закрыть Swagger в проде."
- Lines 39-41: remove `app.include_router(admin.router)`, `app.include_router(admin_users.router)`,
  `app.include_router(uploads.router)`.
- Lines 43-45 (`StaticFiles` mount at `/static/img`): **keep** — this only serves already-uploaded image files
  (read path); disabling it would break every `img`/`photo`/`logo` URL in the bundle that points at
  `/static/img/...`. Only the **write** endpoint (`uploads.router`'s `POST /api/admin/uploads/image`) is Phase 2 —
  that's already covered by dropping the router include above.
- Lines 48-50 (`/health`): make it actually check the DB — `db.execute(text("SELECT 1"))` in a try/except,
  returning `200` when reachable and `503` otherwise. `railway.json` already points its healthcheck at `/health`;
  right now that's a static `200` regardless of DB state, which defeats the point of a healthcheck on a Railway
  deploy that depends on Postgres being reachable.

### `app/auth.py`

- Lines 60-65 (`clear_auth_cookie`): `response.delete_cookie(key=COOKIE_NAME, domain=COOKIE_DOMAIN, path="/")` is
  missing `secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE`. Browsers only clear a cookie when the delete call's
  attributes match how it was set (`set_auth_cookie` at lines 47-57 sets `secure`/`samesite` explicitly) — in
  cross-origin prod (`SameSite=None; Secure`), a delete call without those attributes can fail to clear the
  session cookie, leaving the user logged in until natural token expiry. **Fix**: pass the same
  `secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE` to `delete_cookie`. Audit item 7.
- Line 77: `user = db.get(User, int(payload["sub"]))` — `int(...)` throws unhandled on a malformed/non-numeric
  `sub` claim (crafted or corrupted token) → FastAPI returns `500` instead of `401`. **Fix**: wrap in
  `try/except (KeyError, ValueError, TypeError): raise HTTPException(401, "Invalid session")`. Audit item 8.
- Lines 31-37 (`create_access_token`): drop the `"role": role` claim from the JWT payload entirely — `require_admin`/
  `require_editor` (lines 83-92) authorize off `user.role` re-fetched fresh from the DB via `get_current_user`, never
  off the token's `role` claim, so it's a dead field on every token (audit: "мёртвый claim role в JWT"). Update the
  function signature to `create_access_token(user_id: int) -> str` and its one call site in
  `routers/auth.py:26` (`create_access_token(user.id, user.role)` → `create_access_token(user.id)`).
- **Login rate-limiting / enumeration** (`routers/auth.py:19-25`): `verify_password` (bcrypt) only runs when
  `user` is found (`if not user or not verify_password(...)` short-circuits) — a nonexistent username returns
  near-instantly while a wrong password for a real username takes a measurable bcrypt-hash amount of time, letting
  an attacker enumerate valid usernames by timing. Given this is a small closed-staff app (12 users), full
  constant-time hardening (checking against a dummy hash when `user` is `None`) is a nice-to-have, not urgent.
  **What's actually missing today: there is no rate limiting on `/api/auth/login` at all.** Add an IP-based (or
  IP+username) fixed-window limiter (e.g. 5 attempts/minute) as a concrete, low-effort 1a task — this is the
  higher-value fix of the two.
- **Token revocation / TTL**: `ACCESS_TOKEN_EXPIRE_HOURS=24` fixed TTL, no revocation mechanism — logout only
  clears the client cookie; a copied/stolen token stays valid up to 24h even after logout or a password change.
  Options to note for the plan author (not necessarily 1a-blocking): (a) shorten the TTL (4-8h) to shrink the
  exposure window; (b) add a `token_version` column on `users`, bumped on password change/forced logout, embedded
  in the JWT and checked in `get_current_user` — cheap, gives instant revocation without a session store; (c) a
  server-side session/opaque-token store (Redis) for true per-token revocation — heavier, defer.

### `seed.py`

The whole content-seeding machinery is now **obsolete** — the v2 DB is already fully populated via ETL
(`backend/migration/*`) from prod. Only a one-shot admin bootstrap should remain, per the task's explicit
instruction and audit **C-1**/**HIGH-1** ("Сид на каждом старте... переписывает роль/пароль/имя 12 юзеров").

- **Delete** the hardcoded `USERS` list (lines 32-45) — 12 real staff usernames + **plaintext passwords** committed
  to source control. This needs a companion **operational** action, not just a code fix: rotate all 12 leaked
  passwords and purge them from git history — call this out to the user/team explicitly, it's not something the
  code change alone resolves.
- **Delete**: `seed_kitchen` (78-109), `_cleanup_legacy_urls` (115-135), `seed_encyclopedia` (138-202),
  `seed_content` (236-450), `seed_categories` (63-75), `DEFAULT_CATEGORIES` (52-60), `DATA_PATH`/`KITCHEN_PATH`/
  `ENCYCLOPEDIA_PATH` (47-49) — all content/category seeding, entirely superseded by the migrated v2 data.
- **Rewrite** `seed_users` (205-220): today it unconditionally loops the hardcoded roster and overwrites
  `password_hash`/`role`/`name` on **every run**, which is the literal root cause of C-1/HIGH-1. Replace with:
  if `db.query(User).first()` returns anything, **no-op** (log "users table not empty — skip; v2 users already
  migrated from prod"). Only on a genuinely empty `users` table (fresh/local/never-happens-in-real-v2-prod-path)
  optionally bootstrap exactly one admin from required env vars (e.g. `SEED_ADMIN_USERNAME` +
  `SEED_ADMIN_PASSWORD`, both-or-neither; skip with a warning if only one is set) — never a hardcoded roster of
  real people's passwords again.
- `main()` (453-489): drop the `init_db()` call (454) and all the `seed_categories`/`seed_kitchen`/
  `seed_encyclopedia`/`seed_content` calls (460-486) — leave essentially just the now-no-op-by-default
  `seed_users()` bootstrap.
- **`Dockerfile:30`**: `CMD ["sh", "-c", "python seed.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`
  — remove `python seed.py &&` from the boot command (audit item 1: "сделать одноразовым, вне boot"). `seed.py`
  becomes a manually-invoked one-off (`python seed.py`), run by an operator only when actually needed, never
  automatically on every container start/restart.

### `app/schemas.py` / `app/routers/content.py` / `app/routers/me.py`

Model references that **must** change (v1 names no longer exist in `models.py`):

| v1 name (content.py:7-11) | v2 replacement |
|---|---|
| `Cocktail` | `Drink` |
| `CocktailTag`, `CocktailFlavor` | `DrinkTag`, `DrinkFlavor` (+ new `DrinkSpirit`, `DrinkDetail`) |
| `ZeroCocktail`, `ZCDrink` | gone — merged into `Drink` (`is_alcoholic`/`is_zero_culture` flags) |
| `ClassicRelatedCocktail` | `ClassicRelatedDrink` (relationship renamed `related_cocktails` → `related_drinks`, attribute `r.cocktail` → `r.drink`) |

Practically, this means:

- `_serialize_cocktail`, `_cocktails_query`, `_serialize_zero`, `_serialize_zc`, `_parse_ingredients`
  (`content.py:49-128`) get replaced by a single `_serialize_drink(d: Drink) -> DrinkOut` covering both
  alcoholic and non-alcoholic rows (via `is_alcoholic`), building `descriptors`/`spirit`/`spirits`/`badge` per
  Part A.2.
- `_serialize_classic`/`_classics_query` (`content.py:65-143`) updates: `c.related_cocktails` → `c.related_drinks`,
  `r.cocktail.slug` → `r.drink.slug`, plus the `year`/`recipe`(=`composition`)/`fits`(=`for_whom`) naming per A.3.
- The `zero_rows`/`zc_rows` queries and their serialization (`content.py:158-169`, `189-190`) are deleted outright
  — no more separate tables.
- `KitchenDishOut` (`schemas.py:139-152`) and its construction (`content.py:192-203`) need a full rewrite: old flat
  `price`/`weight`/`timing`/`nutrition` text fields → new typed `price_amount`/`weight_g`/`timing_min_low+high`/
  `kcal_portion`+`protein_g`+`fat_g`+`carb_g` columns, per A.6.
- `SpiritEntryOut` (`schemas.py:112-127`) references `brand_country`, which **does not exist** on the v2
  `SpiritEntry` model (retired per audit item 12, replaced by separate `brand`/`country`/`description` columns) —
  remove it; rename the JSON keys to match the kit exactly (`pairings`, `sourceUrl` handling) per A.5.
- `COCKTAIL_SPIRIT_FILTERS`/`COCKTAIL_GLASS_FILTERS` (`content.py:27-46`): replace the hardcoded lists with
  DB-derived `DISTINCT` queries per A.7 (or keep hardcoded if the plan author prefers simplicity for 1a, but note
  the staleness risk the v1 comment already calls out).
- **Redundant standalone endpoints** `GET /api/cocktails`, `GET /api/classics`, `GET /api/families`
  (`content.py:227-240`): duplicate data already in `/api/content`; nothing in the kit block calls them
  individually. **Recommend dropping all three.** If kept for convenience/testing, at minimum rename
  `/cocktails` → `/drinks` to match the unified model.
- `me.py:21-28` (`KIND_MODELS`): rewrite to
  `{"menu": Drink, "classics": Classic, "kitchen": KitchenDish, "spirits": SpiritEntry}` — drop the `"zero"`/`"zc"`
  keys entirely (matches `models.py`'s own comment: `kind in menu/classics/spirits/kitchen`).
- `me.py:100-117` (legacy classics-only shortcut routes): **delete** — see Part B rationale.
- `me.py:71-81` (`mark_learned` race): fix with a real upsert — see Part B.

### Deploy (`Dockerfile` / `railway.json`)

- `Dockerfile:30` final `CMD`: `["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]`
  — Alembic now owns schema application on every boot (idempotent, safe to re-run); `seed.py` is no longer part
  of the boot path at all (see `seed.py` section above).
- `Dockerfile:11-22`: the dependency install is a **hand-maintained pip-install argument list** duplicating
  `pyproject.toml` — this existed because the old `pyproject.toml` was missing `python-multipart`/`Pillow`
  (audit item 6). **That's already fixed** in this repo's `pyproject.toml` (it now lists `fastapi`, `uvicorn`,
  `sqlalchemy`, `psycopg2-binary`, `python-jose`, `bcrypt`, `python-dotenv`, `pydantic`, `alembic`,
  `python-multipart`, `Pillow` — everything the hardcoded list has, plus `alembic`). Recommend simplifying to
  `uv pip install --system --no-cache -e .` (or `uv sync --frozen` against `uv.lock`, which already exists) instead
  of hand-listing packages twice — removes drift risk entirely now that the manifest is correct. Nice-to-have,
  not blocking.
- `railway.json`: `healthcheckPath: "/health"` is already correct; once `/health` does a real DB check (see
  `main.py` above) this becomes a meaningful readiness probe instead of a static `200`. No other change needed —
  keep the start command in the Dockerfile `CMD` (single authoritative place) rather than also setting
  `deploy.startCommand` in `railway.json`.

---

## D. Suggested task breakdown (Phase 1a)

Ordered so cleanup lands first (safe, mechanical, no schema/serialization risk) and the new-serialization work
builds on a clean base; smoke tests close it out.

1. **[cleanup] Config & secrets hardening** — `config.py`: required `SECRET_KEY`/`DATABASE_URL` (fail-fast, no
   defaults), add `DEBUG` flag. *Deliverable*: app refuses to boot with a clear error when either is unset;
   a unit test asserts the `RuntimeError`/`KeyError`.
2. **[cleanup] Database bootstrap cleanup** — `database.py`: delete `create_all`/`_COLUMN_MIGRATIONS`/
   `_DATA_MIGRATIONS`/`init_db()`; `main.py` lifespan stops calling it; `/health` does a real `SELECT 1`.
   *Deliverable*: app boots against the Alembic-managed v2 DB with zero ad-hoc DDL; `GET /health` returns 200
   when the DB is reachable, 503 when it isn't (test by pointing at a bad `DATABASE_URL`).
3. **[cleanup] `main.py` surface reduction** — drop `admin`/`admin_users`/`uploads` router includes (keep the
   read-only `/static/img` mount), gate Swagger/OpenAPI/ReDoc behind `DEBUG`. *Deliverable*: `/api/admin/*`
   routes 404, `/api/docs` 404 with `DEBUG=false` and 200 with `DEBUG=true`.
4. **[cleanup] Auth hardening** — `auth.py`: fix `clear_auth_cookie` secure/samesite, guard `int(payload["sub"])`
   → 401, drop the JWT `role` claim (+ update `routers/auth.py` call site), add a login rate-limit dependency.
   *Deliverable*: logout actually clears the cookie (assert via `TestClient`'s cookie jar), a malformed/tampered
   token returns 401 not 500, 6th login attempt within a minute from the same client returns 429.
5. **[cleanup] `seed.py` reduction to one-shot admin bootstrap** — strip all content-seeding; `seed_users` becomes
   a no-op once any user exists, env-var bootstrap only on a genuinely empty table; remove the hardcoded plaintext
   roster; drop `python seed.py` from the Dockerfile `CMD` (replaced by `alembic upgrade head`).
   *Deliverable*: running `seed.py` against a DB that already has users changes nothing (diff password hashes
   before/after); against an empty DB + env vars it creates exactly one admin.
6. **[new serialization] `/api/content` bundle rewrite** — rewrite `schemas.py` (Drink/Classic/SpiritEntry/
   KitchenDish/Family/Section/filter shapes per Part A) and `content.py`'s queries/serializers against
   `Drink`/`DrinkSpirit`/`DrinkFlavor`/`ClassicRelatedDrink`/etc.; drop or rename the standalone `/cocktails`,
   `/classics`, `/families` endpoints. *Deliverable*: `GET /api/content` validates against the Part A shape, with
   at least one real record per section (one alcoholic drink, one non-alcoholic drink, one classic with
   `ourAnswers`, one spirit entry, one kitchen dish) confirmed field-by-field against the source DB rows.
7. **[new serialization, small] Progress endpoints for v2 kinds** — `me.py`: `KIND_MODELS` → `Drink`/`Classic`/
   `KitchenDish`/`SpiritEntry` (4 kinds only), drop the legacy classics-only shortcut routes, fix the
   `mark_learned` race with a real upsert. *Deliverable*: `POST`/`DELETE /api/me/progress/{kind}/{slug}` works for
   all 4 kinds against real slugs pulled from the bundle; unknown `kind` → 400; two concurrent `POST`s for the
   same key don't 500.
8. **[cleanup] Deploy/manifest cleanup** — Dockerfile `CMD` final form (`alembic upgrade head && uvicorn`),
   simplify the dependency install to use `pyproject.toml`/`uv.lock` instead of the hand-maintained pip-install
   list. *Deliverable*: a fresh container build+boot against an empty-but-migrated DB succeeds end-to-end
   (`docker build && docker run`, or the equivalent CI step).
9. **[integration] TestClient smoke suite** — `tests/test_smoke.py`: login with a known seeded user → `GET
   /api/content` (assert every top-level key from Part A is present and non-empty) → `POST
   /api/me/progress/classics/{slug}` → `GET /api/me/progress` confirms the slug is present → `DELETE` → confirms
   it's gone; also assert `/api/admin/*` 404s and `/api/docs` 404s under default (non-`DEBUG`) config.
   *Deliverable*: `pytest` green; one command exercises the full login → content → progress happy path plus the
   Phase-2-disabled assertions.
