# Data-parity audit — LOOKUPS + PROGRESS + USERS + TIMELINE + CATEGORIES + SECTIONS

Scope: `glasses/spirits/tags/flavors/descriptors/badges/families/categories` (old, all in
`backend/migration/source.py::_TABLES`) → `backend/migration/load.py` step 1 → new lookup
tables (`backend/app/models.py`); `learning_progress` (old+new, load.py step 11); `users`
(load.py step 1); `timeline_entries` (load.py step 1); `categories` → `sections` (load.py
step 1 filter + `content.py::get_content`).

Method: direct row-level SQL diff between `SRC_DATABASE_URL` (prod, read-only) and
`DEST_DATABASE_URL` (new dev), cross-checked against `backend/migration/load.py`,
`backend/app/models.py`, `backend/app/routers/{content,me}.py`, `backend/app/schemas.py`,
`frontend/src/data/mapBundle.ts`, `frontend/src/pages/cocktail-guide/*.tsx`, the captured
`bundle.json` snapshot, and the old frontend on `git show main:frontend/src/**`.

**7 findings: 0 high / 2 med / 5 low.** (No HIGH findings in this domain — every table was
migrated with zero row loss and zero orphans; all gaps found are either deliberate
documented redesign choices or previously-known/tracked deferrals.)

## Findings

| id | field | old location | new location | class | severity | example | suggested fix |
|---|---|---|---|---|---|---|---|
| LP-1 | `categories` → `sections` (zero/zc removal) | old `categories`: 6 rows incl. `zero`("Non Alco") and `zc`("Zero Culture"), both distinct burger-menu items with their own pages (`ZeroPage`/`ZCPage`, filters, badges, caffeine meter) | `load.py:173-176` explicitly skips `key in ("zero","zc")` when loading `categories`; new `categories` = 4 rows (menu/classics/spirits/kitchen); `content.py`'s `sections` list therefore has no `zero`/`zc` entry. Underlying content is **not lost**: `zero_cocktails`+`zc_drinks` were merged into the unified `drinks` table (`is_alcoholic`/`is_zero_culture`/`caffeine_level`/`is_carbonated` columns) and are browsable via an Алко/Безалко filter inside the single "menu" section (`views.tsx:127` — comment "isAlcoholic вместо отдельных разделов (blueprint §E.2)"; `detail-sheet.tsx`'s `NonAlcIndicators` reproduces the caffeine-dot-meter + carbonation indicator). | FORMAT (deliberate redesign, not a bug) | LOW | bundle.json `sections` = `[{id:"menu",total:26},{id:"classics",total:67},{id:"spirits",total:74},{id:"kitchen",total:33}]` — no `zero`/`zc` id; but all 26 `menu`-section drinks include the former 1 zero_cocktail (`gaslight_americano`) + 1 non-duplicate zc_drink (`gaba`, name kept with its trailing period) + 24 cocktails, so item count is exact (24+1+2−1 Upcykle-dedup = 26) | None required — documented, functionally-equivalent redesign (§blueprint E.2). If product wants the *navigation* distinction back (not just a filter), that's a UI decision, not a data-loss fix. |
| LP-2 | Tag lookup usage downstream | old `tags` (14 rows, no `label` column): only the 6 spirit-type keys (`gin/vodka/rum/bourbon/brandy/mezcal`) were ever rendered, via a hardcoded `SPIRIT_LABELS` dict in `CocktailCard.jsx` (Russian labels) + used for the spirit filter pills; the other 7 keys (`bitter/blended/fizzy/hot/premium/sour/sweet`) were assigned to cocktails via the admin `ChipsField` but **never rendered anywhere in the public old UI** (verified: no other `.tags` usage in `main:frontend/src` besides `CocktailCard.jsx`/`App.jsx` filter/`CocktailEditor.jsx`) | `load.py:156-159` migrates 13/14 tags (drops `test-tag`, confirmed junk) with `label=key.title()`; `drink_tags` link table is fully repopulated (63/63 rows, exact match). But `content.py::_serialize_drink`'s `descriptors` field is built from `d.spirits`/`d.flavors` only — `d.tags`/`Tag` is **never read** by the serializer, so no tag (spirit-type or generic) reaches the bundle today. | STRANDED (lookup + link table present, unused by bundle) | MED | tag `bitter` (id 1): present in new `tags` table with `label="Bitter"`, attached via `drink_tags` to whichever cocktails had it in prod, but absent from every `bundle.json` drink object | This is the data-side twin of the already-known drinks-domain finding ("DrinkSpirit never populated" → empty spirit filter). Fixing that finding (reading `DrinkTag`/populating `DrinkSpirit` and wiring `descriptors`/filters from it) will also resolve this one — no separate lookup-side fix needed. Flagged here only for lookup-domain completeness; owned by the drinks auditor. |
| LP-3 | `tags.label = key.title()` | old `tags` had **no** `label` column at all (`database.md` §1.1); old admin UI (`CocktailEditor.jsx`) showed raw keys as chips (English, lowercase); the *only* Russian label ever shown for a tag was the hardcoded 6-key `SPIRIT_LABELS` subset (see LP-2), which is unrelated to this new column | new `Tag.label` (`models.py:42`) is derived purely in the ETL as `key.title()` — e.g. `bitter`→`Bitter`, `mezcal`→`Mezcal` | FORMAT (new derived field, not present before) | LOW (no regression) | tag `sour`→label `"Sour"` | Not a regression: old never showed a Russian/localized tag label outside the unrelated `SPIRIT_LABELS` map (out of scope here, see LP-2/known finding). If tags are ever surfaced (see LP-2), consider a proper Russian label map instead of `.title()`, but this is a forward enhancement, not a lost-data fix. |
| LP-4 | `timeline_entries` (8 rows) | old `timeline_entries` table; old bundle carried `data.timeline`, but **no old frontend component ever rendered it** (`frontend-inventory.md` §1.13: "fetched but unused in the live UI (dead/latent feature)"), confirmed via `git grep` on `main:frontend/src` — no `timeline` JSX consumer exists | migrated 8/8, byte-identical (`period/description/examples/sort_order` all match old exactly, verified via full-row diff). Not present in `ContentBundleOut` (`schemas.py`) or `content.py`'s serializer, and not referenced anywhere in `frontend/src` (v2). `models.py:304` even comments "Timeline (retained; not surfaced yet)". | STRANDED (correctly classified per audit brief — not LOSS) | LOW | all 8 rows present in new `timeline_entries`, e.g. id 9's `period`/`description`/`examples` match old verbatim | None required for parity (data is safe). Matches `docs/STATUS.md`'s own backlog line: "History/timeline section (data preserved)". Since this was **already dead in the old UI too**, there is zero behavior regression for users — lower urgency than a typical STRANDED item. |
| LP-5 | Admin management of `categories` (rename/reorder/show-hide) and `users` (CRUD) | old `admin/CategoriesTab.jsx` (rename, reorder, visibility toggle) and `admin/UsersPage.jsx`/`UserEditor.jsx` (create/edit/delete users) — both full CRUD surfaces, admin/admin-or-editor gated | `backend/app/routers/admin.py` and `admin_users.py` exist but are **not mounted** in `app/main.py` (only `auth`, `content`, `me` are included) — confirmed by reading `main.py`. `admin.py` additionally still imports pre-redesign model names (`Cocktail`, `ZeroCocktail`, `ZCDrink`, `ClassicRelatedCocktail`, `CocktailTag`, …) that no longer exist in the current `models.py` (which only has the unified `Drink`/`DrinkTag`/… classes) — so the file would fail to import if it were wired up as-is. | STRANDED capability (data intact; write/management surface absent) | LOW | `GET/PATCH /api/admin/categories`, `POST /api/admin/categories/reorder`, `GET/POST/PATCH/DELETE /api/admin/users` all 404 today (routers unmounted) | Already tracked, not a silent gap: `docs/STATUS.md` explicitly documents "admin/admin_users/uploads routers DISABLED (Phase 2, still reference old models)". No fix needed for *this* audit — flagged only so category/user management isn't mistaken for a migration loss. Rebuild these routers against the new `Drink`-unified schema in Phase 2. |
| LP-6 | `learning_progress` idempotent `slug_remap` for Upcykle-style zc/cocktail dedup | old `learning_progress` never had any row with `kind` other than `classics`/`kitchen`/`menu` (verified: `GROUP BY kind` → exactly 3 groups, 162+21+6=189, no `zero`/`zc`/`spirits` rows exist in prod at all) | `load.py` step 11 remaps a `kind="menu"` progress row whose slug was a *dropped* zc_drinks slug (e.g. `upcykle_cola`) to the *kept* canonical drink slug (`upcyklecola`) before insert — verified this logic is safe and, in today's data, a no-op: no old progress row ever referenced `upcykle_cola`/`gaba`/`gaslight_americano` under any kind, so nothing was actually remapped or at risk of becoming orphaned | OK (verified defensive code; no data was at risk) | — | n/a — confirmed no orphan slugs in new `learning_progress` for any kind (menu/classics/kitchen), 0 rows point at a slug missing from `drinks`/`classics`/`kitchen_dishes` respectively | n/a |
| LP-7 | Extra rows present only in DEST (dev-only, not migration artifacts) | n/a (not from prod) | new `users` has 1 extra row beyond the 12 migrated (`id 33, username v2tester`, created 2026-07-20, per `docs/STATUS.md`'s own local-dev-login note); new `learning_progress` has 1 extra row beyond the 189 migrated (`user_id 4, kind classics, slug odette_philippe`) | N/A (local dev-testing artifact, not a parity issue) | — | `SELECT * FROM users WHERE id NOT IN (1..12)` → `v2tester` only | `docs/STATUS.md` already lists "remove the `v2tester` dev user" as an operational pre-cutover step; no other action needed. |

## Coverage / OK-verified groups

- **glasses** (12/12), **spirits lookup** (9/9), **badges** (4/4), **families** (9/9): full
  row-level compare (id, key, label, sort_order, +family's sub/color/logic/evolution/tip) —
  **zero diffs, zero missing ids** in all four tables.
- **tags**: 14→13, exactly one row dropped (`test-tag`, id 14) — confirmed genuine QA/test
  artifact per `docs/audit/details/database.md` §3.6 and load.py's own `JUNK` set/comment.
  `test-tag` had **zero** `cocktail_tags` references in prod (dictionary cruft, not an
  orphan risk) — confirmed `cocktail_tags` (63) = `drink_tags` (63) exactly, so dropping it
  didn't silently remove any cocktail's real tag assignment.
- **flavors**: 59→58, exactly one row dropped (`ДОБАВЛЕНО ИЗ UI`, id 59) — confirmed test
  artifact, zero remaining-row label diffs, `cocktail_flavors` (87) = `drink_flavors` (87)
  exactly.
- **descriptors**: 80→78, exactly two rows dropped (`Тестовый` id 78, `Обновлённый` id 80) —
  both confirmed test artifacts, zero remaining-row label diffs.
- **`Габа.`/`Ирдандия` deliberately-kept typos**: confirmed present, byte-identical, in the
  new DB — `drinks.name = "Габа."` (slug `gaba`, trailing period intact) and
  `spirit_entries.description = "Ирдандия"` for all 3 Waterford rows (ids 19/20/21; moved
  from old `brand_country` to new `description` verbatim by `parse_spirit_origin`, per
  `load.py`'s module docstring/`JUNK` comment — these are content typos, correctly *not*
  auto-corrected by the ETL).
- **categories**: 6→4 (only `zero`/`zc` skipped, exactly as `load.py:173-174` intends); the
  remaining 4 (`menu/classics/spirits/kitchen`) are byte-identical (key/label/kind/sort_order/
  is_visible) old→new. See LP-1 for the zero/zc-removal analysis.
- **sections** (`content.py`'s derived `SectionOut` list): counts verified against
  `bundle.json` and independently against direct DB counts — menu 26, classics 67, spirits
  74, kitchen 33 — all match `db.scalar(select(func.count())...)` exactly; ordering matches
  `sort_order` (0,1,2,5).
- **users**: all 12 prod users present with every column intact (id, username,
  password_hash, role, name, created_at) — full row-level compare, zero diffs. No column
  dropped (old and new `information_schema.columns` for `users` are identical). See LP-7 for
  the one dev-only extra row.
- **learning_progress**: all 189 prod rows present **unchanged** (exact `(user_id, kind,
  slug)` set match, verified via set-difference — `old - new = {}`). Per-kind counts old vs
  new: `classics` 162→163, `kitchen` 21→21, `menu` 6→6 (the +1 on classics is the LP-7
  dev-added row, not a migration artifact). Zero orphans: every `menu` slug resolves in
  `drinks`, every `classics` slug resolves in `classics`, every `kitchen` slug resolves in
  `kitchen_dishes`, in both old and new. Old had **no** `zero`/`zc`/`spirits`-kind progress
  rows at all (0 in prod), so there is nothing that could have been "folded into menu" or
  lost by the kind restriction — the 3 old kinds map 1:1 to 3 new kinds.
- **`classic_progress`** (legacy duplicate progress table, out of the brief's explicit list
  but adjacent): confirmed correctly **not** migrated (table doesn't exist in new schema);
  verified all 3 of its rows (`user 1`: `whiskey_sour`, `daiquiri`, `vodka_martini`) are
  already present in `learning_progress` under `kind='classics'` — a true stale subset, drop
  is lossless, matches `database.md`'s own conclusion.
- **`/api/me/progress`** (new API): kinds `menu/classics/kitchen/spirits` all supported
  (`me.py`'s `KIND_MODELS`), covering every kind that ever had data in prod.
