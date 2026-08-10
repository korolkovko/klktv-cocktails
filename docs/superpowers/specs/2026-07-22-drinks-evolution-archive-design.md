# Авторские evolution + Archive — design spec

**Date:** 2026-07-22 · **Branch:** `v2` · **Status:** approved design, pre-plan.

## Goal

Evolve the **Авторские (drinks)** section and add a cross-content **archive** so the tool is production-grade: drink categories (Kitchen-style sections), a first-class «Горячий» flag, an «Лёд» field, glass/badge/ice managed as **dictionaries** (no raw keys), portrait-friendly **multi-photo** galleries, and **archive-instead-of-delete** for all content items.

## Locked decisions (from brainstorming)

- **Categories** = Kitchen-style **sections** on the guide, with the existing **Алко/Безалко** kept as a filter on top (and the existing Спирит/Бокал/Тип dropdowns still apply).
- **Archive** hides items **entirely from the guest**; applies to **items only** (drinks / classics / spirit entries / kitchen dishes) — not taxonomy.
- Hard **delete stays** available in admin (real mistakes); **archive is the primary "retire" action**.
- Categories are **required** on a drink; migration seeds a default «Основные» category and assigns all existing drinks to it.
- Photos: detail view is a **swipe carousel**; frame is **portrait `aspect-[3/4]` + `object-contain`** on a neutral bg (nothing crops; exact ratio tuned on real photos in Phase C).

## What already exists (reuse, don't rebuild)

- `glasses` and `badges` are already lookup tables (`key` + `label` + `sort_order`); drinks FK them via `glass_id` / `badge_id`. The admin currently exposes them as **free-text "enter a key"** — this spec turns them into managed dictionaries. No new table for these two.
- «HOT next to the name» already exists but as a magic string: the guest gets `badge = badge.key.upper()` (content.py) and the frontend special-cases `badge === "HOT"`. This spec promotes it to a real `is_hot` boolean.
- `spirit_categories.is_archived` already exists (leave as-is). Kitchen/Spirit **category subpanels** in the admin (`SpiritsPage`/`KitchenPage`) are the pattern for the new dictionary/category managers.

---

## Phase A — Archive + dictionaries + «Горячий» (schema + admin; low risk)

### A1. Archive (items only)

**Schema:** add `is_archived BOOLEAN NOT NULL DEFAULT false` to `drinks`, `classics`, `spirit_entries`, `kitchen_dishes`. Alembic revision, additive; no data backfill (default false = all currently active). Index not required (small tables).

**Backend:**
- `*AdminOut` / `*WriteIn` gain `is_archived`. The full-record PATCH appliers set it. List endpoints already return the full `*AdminOut`, so admin sees the flag.
- Consumer `/api/content` (`content.py`) filters `WHERE is_archived = false` for drinks/classics/spirit-entries/kitchen-dishes. `learning_progress` rows on archived items are **left in the DB** (no cascade) — an unarchive restores visibility with history intact.

**Admin (frontend):**
- Each item page's `EntityTable` gains a toolbar filter chip **«Активные / Архив / Все»** (default «Активные»). Archived rows show a muted «архив» pill in identity/columns.
- Retire path: an **«В архив» / «Вернуть из архива»** action in the ⋯ menu **and** a toggle in the §50 form. Hard-delete (arcade hold) stays as a separate, less-prominent action.
- `is_archived` is a plain boolean threaded through the existing `fromAdminOut`/`toWriteIn` mappers.

### A2. Dictionaries: Стакан / Бейдж / Лёд

**Schema:** new `ice_types` table `(id, key UNIQUE, label, sort_order)` mirroring `glasses`/`badges`. Add `drinks.ice_id` FK → `ice_types(id)` `ON DELETE SET NULL`.

**Backend:** admin CRUD routers for `glasses`, `badges`, `ice_types` — `GET/POST/PATCH/DELETE /api/admin/{glasses|badges|ice-types}` mirroring the existing spirit-categories/kitchen-categories shape (`*WriteIn` = key/label/sort_order; `key` derived from label on create if omitted; delete 409s if still referenced by any drink). The existing `_get_or_create_glass/badge` stays for compatibility but the admin now manages them explicitly. Drink `*WriteIn`/`*AdminOut` gain `ice` (ice-type key, same shape as glass/badge). Consumer `DrinkOut` gains `ice` (the ice-type label) for the guest detail.

**Admin (frontend):** a shared **DictionaryField** component — a select of existing options **+ «＋ добавить»** inline row (type a label → POST to the dictionary → select it). Used for Стакан, Бейдж, Лёд in the drink form (replaces the raw-key TextFields). Full management (rename / delete / reorder) lives in a compact collapsible **«Справочники»** panel on the Авторские admin page (same pattern as the category subpanels). The user never sees or types a raw `key`.

**Guest:** drink detail shows **«Лёд: <label>»** in the left meta area of the detail sheet (alongside glass/volume). Glass/badge rendering unchanged (badge minus the HOT special-case, see A3).

### A3. `is_hot`

**Schema:** add `drinks.is_hot BOOLEAN NOT NULL DEFAULT false`.

**Migration/backfill:** `UPDATE drinks SET is_hot = true WHERE badge_id IN (SELECT id FROM badges WHERE upper(key) = 'HOT')`; then null those drinks' `badge_id` and delete the now-redundant `hot` badge from the dictionary (its meaning now lives in `is_hot`). Other badges (e.g. ONESIP) untouched.

**Admin:** «Горячий 🔥» toggle in the drink form; `is_hot` on `*WriteIn`/`*AdminOut`.

**Guest:** `DrinkOut.isHot`. Frontend: if `isHot` → the red «HOT» chip next to the name (reuse current styling) + a line in the detail meta; else nothing. Remove the `badge === "HOT"` branches in `views.tsx` / `detail-sheet.tsx`.

---

## Phase B — Categories for Авторские (Kitchen-style)

**Schema:** new `drink_categories` `(id, slug UNIQUE, label, sort_order)` mirroring `kitchen_categories`. Add `drinks.category_id` FK → `drink_categories(id)` `ON DELETE RESTRICT`, `NOT NULL`. **Migration:** seed one category `slug="osnovnye", label="Основные", sort_order=0` and set every existing drink's `category_id` to it (two-step: add nullable → backfill → set NOT NULL).

**Backend:** admin CRUD `/api/admin/drink-categories` (mirror kitchen-categories; delete 409s while non-empty). Drink `*WriteIn`/`*AdminOut` gain `category` (drink-category slug, must exist — not get-or-created, like kitchen.category). `/api/content` groups drinks by category (the bundle exposes drink categories + each drink's `categorySlug`, mirroring the kitchen shape).

**Admin (frontend):** `DrinksPage` gains an inline **DrinkCategoriesPanel** (copy of the kitchen category subpanel) + a **category select** in the drink form + a category filter chip in the toolbar.

**Guest (frontend):** the Авторские view renders **category sections** (headers) like Kitchen; the Алко/Безалко filter and the Спирит/Бокал/Тип dropdowns apply across all sections; empty sections are hidden. Archived drinks (A1) never appear.

---

## Phase C — Photos (aspect + multiple + gallery)

**Schema:** new `drink_photos` `(id, drink_id FK ON DELETE CASCADE, url, sort_order)`. **Migration:** for each drink with a non-null `drinks.photo`, insert one `drink_photos` row (`sort_order = 0`). Keep `drinks.photo` column populated as the **primary** (== first photo) for card thumbnails / backward-compat, OR compute primary from `drink_photos[0]` and stop writing `photo` — **decision:** compute primary from `drink_photos[0]`; `drinks.photo` is dropped from the write path (column may remain, unused, to avoid a destructive drop). `drinks.img` (logo) is unchanged.

**Backend:** `DrinkWriteIn.photos: list[str]` (urls, ordered) replacing scalar `photo`; delete-then-insert on save (same pattern as drink relations). `DrinkAdminOut.photos` + `DrinkOut.photos` (ordered urls). Card/list uses `photos[0]`.

**Admin (frontend):** a **multi-image upload field** (upload several, reorder, remove) in the drink form, reusing `adminApi.uploadImage` per file.

**Guest (frontend):** drink detail shows a **swipe carousel** (dots/index) of `photos`. Frame: portrait **`aspect-[3/4]` + `object-contain`** on a neutral bg — verticals fill, rare horizontals letterbox centered, nothing crops. Exact ratio/affordance tuned on real photos during this phase (owner eyeballs live).

---

## Cross-cutting

- **Migrations:** one Alembic revision per phase (A, B, C), each additive + backfill. Prod data is already live → **no re-ETL**; the ETL parsers may gain the new fields only if a fresh load is ever run (out of scope for this rollout).
- **Media:** photos continue to land on the Railway volume via `adminApi.uploadImage` (`/static/img/…`), same as today.
- **Tests:** backend — per new/changed endpoint (archive filter, dictionary CRUD + 409-on-referenced, drink-categories, drink photos, is_hot backfill logic) + serializer shape tests. Frontend — pure mapper/helper tests (kit pages aren't render-tested under node-vitest) + `npm run build`.
- **Rollout:** phase by phase on `v2`; each phase = build/test/lint → owner-approved push → Railway auto-deploy → live verify (the established loop). Owner verifies on prod after each.
- **Backend off-prod testing:** if backend tests need a DB, spin the ephemeral local pg18 replica (`backend/.env.test`), never the live `tokaido`.

## Out of scope (explicit)

- No public/marketing surface changes; this is the internal login-only tool.
- No re-run of the prod ETL; changes are additive schema + admin/guest wiring.
- Taxonomy archive (categories/families/dictionaries) — not in this round (items only).
- Phase 3 admin **shell** (page-frame/header-menu) remains a separate, later task.
