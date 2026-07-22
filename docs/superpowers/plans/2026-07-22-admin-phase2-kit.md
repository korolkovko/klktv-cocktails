# Admin Kit-Redesign — Phase 2 (content entities) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Rebuild the admin's content-entity tabs (drinks / classics / spirits / kitchen / families / categories) onto the Kollektiv kit — each list on §54 `EntityTable`, each editor on the §50 `ResponsiveDialog` form — matching the Phase-1 `UsersPage` pattern. Users is already done.

**Architecture:** Each entity becomes a **self-contained `<XxxPage>` component** (exactly like `admin/editors/UsersPage.tsx`) that owns its `EntityTable` + toolbar (search + filter chip + CTA/FAB) + `ResponsiveDialog` form + delete (⋯ arcade-hold-3s row action AND a `ConfirmDialog` from the form), wired to the real `adminApi`. `AdminPage` just mounts the right `<XxxPage>` per tab. Category subpanels (spirits/kitchen) live inside their page.

**This is a RESKIN, not a rewrite.** Every editor's business logic already exists and is unit-tested against the real API: `fromAdminOut`/`toWriteIn` mappers, the drink tri-state `is_carbonated` null round-trip, relation lists, image upload, the spirit/kitchen category subpanels, the categories reorder. **Port the presentation** (EntityList→EntityTable, EditorShell modal→ResponsiveDialog, plain-gray FormFields→kit form fields); **preserve the mappers verbatim** (and their tests).

**Tech Stack:** React 19, Vite, TS, Tailwind v4, `@kollektiv` kit (entity-table §54, filter-chip §49, search-input §51, responsive-dialog/responsive-select §50, confirm-dialog, fab, arcade-button, sonner). No `detail-sheet` §52 — the kit canon is explicit: **"форма = 620 §50"**; DetailSheet is for read-only *data detail*, not edit forms. So every editor uses the §50 ResponsiveDialog, same as Users.

## Global Constraints

- **Reference implementation = `admin/editors/UsersPage.tsx`.** Copy its structure: EntityTable(rows/rowKey/identity/identityLabel/columns/actions/onRowClick/search/filters/cta/emptyState) + `Fab` + `ResponsiveDialog` form (title, `contentClassName="sm:max-w-[620px]"`, footer: destructive-Удалить-left / quiet-Отмена / Сохранить) + `ConfirmDialog` + the local `ChipMenu` helper. Keep the same Russian copy tone and mono-caps field labels.
- **Preserve mappers + their behaviour exactly.** Do not "improve" `toWriteIn`/`fromAdminOut`/tri-state/`nutrition_raw` overrides/slug-immutability-on-edit. Slug/key is **read-only on edit** (record identity), editable on create. Keep the `parsed` hints (abv/price/timing/weight/kcal "Распознано: …").
- **Backend request/response shapes are frozen** — mirror `backend/app/schemas_admin.py` 1:1 (already mirrored in each existing editor's local interfaces). `img`/`photo` store the returned `/static/img/…` url string. Category/family single-selects must send a key that **must already exist** (classics.family, spirits.category, kitchen.category are NOT get-or-created); spirit/tag/flavor/descriptor/related lists ARE get-or-created (free text).
- **Delete UX:** row ⋯ → "Удалить" with `fire: true` + `fireSublabel: "HOLD 3 SEC · NO UNDO"` (arcade hold = the confirm); form-footer "Удалить" opens a `ConfirmDialog`. Same as Users.
- **Test limit:** this repo's vitest runs plain node (no jsdom) — kit components call `useIsMobile()`/`window.matchMedia` unguarded, so **do NOT** `renderToStaticMarkup` any page. Test the **pure mappers** (`toWriteIn`/`fromAdminOut`/tri-state/body-builders) — port the existing `XxxEditor.test.tsx` to the new location. `npm run build` (tsc) still typechecks all JSX.
- **Gate per task:** `cd frontend && npm run build && npm run test && npm run lint` all green.
- **Do NOT touch `AdminPage.tsx` in Tasks 2–7** (deferred to Task 8) so the entity pages stay independent files and can be built in parallel. Each page is a NEW file under `admin/editors/`.

---

## Task 1: Shared kit form scaffolding  *(controller builds this first — it's the contract all pages consume)*

**Files:**
- Create: `frontend/src/admin/components/kit/form.tsx` — kit-styled field primitives with the **same prop API** as the old `admin/components/FormFields.tsx` (drop-in): `TextField`, `TextArea`, `NumberField`, `SelectField`, `CheckboxField`, plus `Field`/`FieldHint` (the mono-caps wrapper from UsersPage). Render with kit `Input`/`Textarea`/`Switch`/`ResponsiveSelect`. Place `ui/textarea` + `ui/switch` from the registry if missing.
- Create: `frontend/src/admin/components/kit/image-field.tsx` — kit-styled `ImageField` (same API as old `ImageUploadField`: `{label,value,onChange,hint}`), reusing `adminApi.uploadImage` + `resolveImageUrl`.
- Create: `frontend/src/admin/components/kit/relation-tags.tsx` — kit-styled `RelationTags` (same API as old: `{label,value,onChange,options?,placeholder?,hint?}`).
- Create: `frontend/src/admin/components/kit/chip-menu.tsx` — extract `ChipMenu` from UsersPage (Popover + FilterChip select) so pages share it. Repoint UsersPage's import (only allowed UsersPage edit).
- Create: `frontend/src/admin/components/kit/entity-page.tsx` (optional helper) — a `useEntityCrud` hook OR small `AdminField`/section helpers if it reduces duplication. Keep minimal; only if it earns its place.

**Interfaces produced:** the field API above (identical signatures to old FormFields), `ImageField`, `RelationTags`, `ChipMenu` — so each entity page's field JSX is a near-verbatim port of its old editor with swapped imports.

**Verify:** `npm run build && npm run test && npm run lint`.

---

## Tasks 2–7: entity pages (independent files → parallelizable after Task 1)

Each: create `admin/editors/<Xxx>Page.tsx` porting the logic from the existing `<Xxx>Editor.tsx` (+ subpanels) onto the UsersPage pattern using Task-1 components. Port the existing `<Xxx>Editor.test.tsx` mapper tests to the new file. Do NOT touch AdminPage.

- **Task 2 — FamiliesPage** (simplest; no image, no relations). From `FamilyEditor.tsx`. Key=`key` (read-only on edit). Fields: key, label, sub, color, logic/evolution/tip (textareas), sort_order. Columns: label + key (+ maybe color swatch). Filter chip: none needed (or a sort). CTA "+ Семейство".
- **Task 3 — CategoriesPage** (Разделы; **no create/delete** — relabel/show-hide/reorder only). From `CategoriesTab.tsx`. EntityTable rows = categories; row-click → form with `label` + `is_visible` toggle; keep the reorder affordance (`adminApi.reorderCategories`). No FAB/CTA. Columns: label, key, kind, visible. `noCreateDelete`.
- **Task 4 — SpiritsPage + spirit-categories subpanel** (image + single-select category). From `SpiritEditor.tsx` + `SpiritCategoriesPanel`. Category select options come from the loaded spirit-categories (`adminApi.list("spirit-categories")`). Fields per `SpiritEntryWriteIn`. Subpanel = a small secondary EntityTable/section for spirit-categories CRUD (archive toggle). Columns: name, slug, category.
- **Task 5 — KitchenPage + kitchen-categories subpanel** (image + category + КБЖУ block). From `KitchenEditor.tsx` + `KitchenCategoriesPanel`. Fields per `KitchenDishWriteIn` incl. the numeric nutrition overrides (kcal_portion/protein/fat/carb/kcal_100g) that win over parsed `nutrition_raw`. Columns: name, slug, category.
- **Task 6 — ClassicsPage** (relations, no image). From `ClassicEditor.tsx`. Fields per `ClassicWriteIn`; relations spirits/descriptors/related_drinks via RelationTags; family single-select (must exist — options from `adminApi.list("families")`). Columns: name, slug, family.
- **Task 7 — DrinksPage** (flagship: 2 images + 3 relations + details list). From `DrinkEditor.tsx`. Preserve the tri-state `is_carbonated` (CARBONATED_OPTIONS/carbonatedToOption/optionToCarbonated) EXACTLY, the `DetailsEditor` sub-list, both `ImageField`s (img=Логотип, photo=Фото), relations spirits/flavors/tags. Columns: name, slug, alk/zc, price. Filter chip: Алк/Безалк maybe.

---

## Task 8: AdminPage rewire + retire old surface  *(controller integrates)*

**Files:**
- Modify: `admin/AdminPage.tsx` — replace the giant `TABS` columns + `editing` state + per-entity `<XxxEditor>` modals with: tab bar (keep gating: users adminOnly) that renders `<DrinksPage/> … <UsersPage/>` per tab. Keep the header + `<Toaster/>`. Keep the lazy/code-split boundary (App.tsx unchanged).
- Delete: old `admin/editors/{Drink,Classic,Spirit,Kitchen,Family}Editor.tsx` + `CategoriesTab.tsx` + their `.test.tsx`; old `admin/components/{EditorShell,EntityList,FormFields,ImageUploadField,RelationTags}.tsx` + tests — **only after** confirming nothing else imports them (`grep`).
- Address deferred MINORs from Phase-1 ledger where cheap: category-label `maxLength`, EntityList search stringify (moot once EntityList is gone).

**Verify:** build + test + lint; grep for dangling imports; the admin still lazy-loads.

---

## Final: whole-branch review (opus) + owner push

Dispatch the final reviewer on the whole `960af9a..HEAD` diff. Then build/test/lint, present the complete redesigned admin to the owner for the push (owner reviews live on prod after `git push origin v2`).
