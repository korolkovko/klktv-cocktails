# klktv-cocktails v2 — Admin panel — design spec

**Date:** 2026-07-20. **Status:** approved (owner), ready for implementation plan.

**Goal:** Give staff (editor+) a working admin to CRUD all guide content, manage
users, and upload images; give `kolya` full (admin) access. Rebuild the admin on
the **unified v2 schema** (the old admin targets the retired split
cocktails/zero/zc tables). UI is **functional, not the kit** — a visual redesign
comes later, so keep the frontend simple and easy to re-skin.

## Global constraints

- **Unified drink:** авторские/безалко/zero-culture are one `Drink` row keyed by
  slug, distinguished by `is_alcoholic` + `is_zero_culture` (+ `caffeine_level`,
  `is_carbonated` for non-alc). No separate cocktail/zero/zc entities.
- **Media on the Railway volume:** ALL images live under `UPLOAD_DIR` and are
  served at `/static/img/<name>` (static mount already in `main.py`). No new media
  in `frontend/public`. Existing `/logos/*` and kitchen `/static/img` files are
  migrated onto the volume and DB paths rewritten to `/static/img/…`.
- **Auth roles (existing):** `reader` (consumer only), `editor` (content CRUD +
  uploads), `admin` (everything incl. user management + destructive ops). Reuse
  `require_editor` / `require_admin` from `app/auth.py`.
- **UI:** plain Tailwind forms in `frontend/src/admin/` (TypeScript). Shared form
  primitives + thin per-entity editors. Not kit components.
- **Live reads:** the consumer `/api/content` bundle reads DEST live, so admin
  edits appear in the guide immediately; no cache to bust.

## Architecture

- **Backend:** three routers under `/api/admin/*`, all mounted in `main.py`:
  - `admin.py` — content CRUD (**rewrite** for the v2 schema).
  - `admin_users.py` — user management (**reuse**; verify against current `User`).
  - `uploads.py` — image upload/resize (**reuse as-is**; already v2-ready).
- **Frontend:** an admin area at route `/admin`, rendered only for `editor`+.
  Guest app and admin share auth (`AuthContext`) but are separate UIs.

## Backend — content CRUD (`admin.py`, rewrite)

All endpoints `require_editor`. Slug-keyed for content entities; id/key for
lookups. Each content entity exposes: `GET /…` (list, admin shape), `GET /…/{slug}`
(one), `POST /…` (create → 201), `PATCH /…/{slug}` (update), `DELETE /…/{slug}`
(→ 204). "Admin shape" = the full editable row: ids, `*_raw` columns, all relation
arrays, flags — NOT the kit-shaped bundle.

Entities & their editable fields:

- **Drinks** `/api/admin/drinks` — name, slug, img(logo), photo, subtitle, abv +
  abv_raw, price_amount/price_currency + price_raw, volume_ml, glass (key),
  badge (key), sort_order, is_alcoholic, is_zero_culture, caffeine_level,
  is_carbonated, story fields (recipe, garnish, pitch, about, naming, faq),
  relations: spirits[] (spirit keys → DrinkSpirit), flavors[] (labels →
  DrinkFlavor), tags[] (keys → DrinkTag), details[] ({label,text,sort_order} →
  DrinkDetail). `_apply_drink(db, obj, data)` upserts scalar cols + rebuilds the
  four relation tables (delete-then-insert), mirroring the ETL.
- **Classics** `/api/admin/classics` — name, slug, family (key), year, origin,
  composition, glass (key), garnish, history, for_whom, sort_order; relations:
  spirits[] (keys → ClassicSpirit), descriptors[] (labels → ClassicDescriptor),
  relatedDrinks[] (drink slugs → ClassicRelatedDrink).
- **Spirit categories** `/api/admin/spirit-categories` — slug, label, sort_order,
  is_archived.
- **Spirit entries** `/api/admin/spirits` — slug, category (slug), name, img, abv +
  abv_raw, price_amount/serving_ml + price_raw, flavour, brand, country,
  description, features, cocktail_pairings, fact, source_url, sort_order.
- **Kitchen categories** `/api/admin/kitchen-categories` — slug, label, sort_order.
- **Kitchen dishes** `/api/admin/kitchen-dishes` — slug, category (slug), name, img,
  price_amount + price_raw, tagline, description, timing_min_low/high + timing_raw,
  weight_g + weight_raw, kcal_portion/protein_g/fat_g/carb_g/kcal_100g +
  nutrition_raw, serving, interesting_facts, sort_order.
- **Families** `/api/admin/families` — key, label, sub, color, logic, evolution,
  tip, sort_order.
- **Categories/sections** `/api/admin/categories` — list, PATCH (label,
  is_visible, sort_order), reorder.

Lookups (glasses, tags, flavors, descriptors, badges) are resolved **get-or-create**
from editor input by key/label (reuse `_get_or_create_*` helpers from the old
admin.py). No dedicated lookup CRUD screens in this pass (YAGNI) — they appear
implicitly as drinks/classics are edited.

Validation: unique slug on create (409 on conflict); 404 on missing slug/key;
enum-check role/kind where relevant. Deletes are hard deletes. Deleting a drink
also removes any `ClassicRelatedDrink` rows pointing at it (cascade) — the classic
simply loses that "наш ответ" chip; deletion is never blocked by such a link.
Deleting a drink/dish also removes its `learning_progress` rows (stale progress).

## Backend — users (`admin_users.py`, reuse)

`require_admin`. `GET` (list), `POST` (create: username, name, role, password),
`PATCH /{id|username}` (name, role, password reset), `DELETE /{id|username}`.
Self-protection: an admin cannot delete or demote themselves (guard on
`me.id`/`me.username`). Passwords hashed via `hash_password`. Verify field names
against the current `User` (id, username, password_hash, role, name, created_at,
last_seen_at) — do NOT expose password_hash or overwrite last_seen_at.

## Backend — uploads (`uploads.py`, reuse)

Mount as-is. `POST /api/admin/uploads/image` (require_editor) → resize longer edge
to ≤1600px, re-encode, write to `UPLOAD_DIR`, return `{url:/static/img/<name>,…}`.
`POST /api/admin/uploads/resize-existing` (require_admin) batch-resizes the volume.
Editors save the returned `url` into the entity's img/photo field.

## Storage / media migration (one-time)

1. Ensure `UPLOAD_DIR` is a persistent Railway **volume** mount in prod; in dev use
   a stable gitignored dir `backend/.uploads` (not `/tmp`, which is wiped on
   reboot) so migrated media + test uploads persist locally.
2. Copy the 24 drink logos (`frontend/public/logos/*`) and the downloaded kitchen
   photos into `UPLOAD_DIR` (renamed to safe `/static/img` names).
3. Rewrite DB `drinks.img` from `/logos/<f>` → `/static/img/<f>` and confirm
   kitchen `img` already `/static/img/…`. Idempotent, re-runnable.
4. Simplify `frontend/src/lib/img.ts`: everything non-absolute is `/static/img/…`
   → backend origin; drop the `/logos/` passthrough special-case.
5. Provide the migration as a re-runnable script under `backend/migration/` (not
   the main ETL) + document the Railway volume mount.

## Frontend — admin area

- Route `/admin` gated to `editor`+ (redirect readers to the guide). Reachable via
  an "Админка" entry shown only to editor+ (desktop user menu + mobile sections
  sheet). URL-routed like the guide.
- **Shared primitives** (`frontend/src/admin/components/`): `TextField`,
  `TextArea`, `NumberField`, `CheckboxField`, `SelectField`, `ImageUploadField`
  (calls the uploads endpoint, previews, stores the returned url),
  `RelationTags` (add/remove keys/labels), `EntityList` (searchable table + row
  actions), `EditorShell` (modal/drawer with save/cancel/delete).
- **Per-entity editors** composed from primitives: DrinkEditor, ClassicEditor,
  SpiritEditor (+ category rows), KitchenEditor (+ category rows), FamilyEditor,
  CategoriesTab, UsersPage. DrinkEditor is the largest (all flags + 4 relation
  pickers + story fields + logo/photo upload).
- **Admin API client** (`frontend/src/admin/api.ts`): typed wrappers over
  `/api/admin/*` (reuse the base `api` + credentials).
- **Tabs order:** Авторские · Классика · Спириты · Кухня · Семейства · Разделы · Юзеры.

## kolya access

One-off: set `kolya.role = 'admin'` in DEST (keep the existing password). The
`admin` user is already admin. Document the SQL/script; at cutover the same bump
applies to prod.

## Testing

- **Backend (pytest):** per content entity — create/update/delete happy path,
  auth gating (reader→403, editor ok, admin-only routes reject editor), slug
  conflict (409), missing (404). Users: role protection (can't self-delete/demote),
  password hashing, no password_hash leak. Uploads: image round-trip (bytes →
  resized file → url), non-image rejected, oversize rejected.
- **Frontend:** `npm run build` clean; a light vitest for the admin api client /
  a mapping helper. No heavy UI tests (redesign pending).

## Out of scope (this pass)

- Kit-styled admin UI (redesign later, together).
- Dedicated lookup-management screens (glasses/tags/… managed inline).
- Audit log / change history.
- Timeline/History entity editor (that data is preserved but unrendered).
- Bulk import/export.

## Build order

1. Media migration + `UPLOAD_DIR` on a stable path + mount `uploads.py`.
2. Rewrite `admin.py` for the v2 schema; mount `admin.py` + `admin_users.py`; tests.
3. Bump `kolya` → admin.
4. Frontend admin shell + shared primitives + per-entity editors + admin entry.
5. Wire image upload into DrinkEditor/SpiritEditor/KitchenEditor.
