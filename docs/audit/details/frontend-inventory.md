# Frontend Feature Inventory — klktv-cocktails (Kollektiv closed cocktail menu)

Read-only audit of `_src/frontend/src`. Scope: React 18 + Vite, hand-rolled JSX, no router, no design system. All content is fetched from a FastAPI-style backend at build-configurable `VITE_API_URL`. This document is a rebuild checklist: **the new frontend must reproduce every capability listed in section 1.**

Stack facts:
- `package.json`: only deps are `react`/`react-dom` 18.3. No router, no state lib, no UI kit, no color-extraction lib (hand-rolled). Vite 6, ESLint 9.
- `index.html`: `lang="ru"`, `noindex/nofollow` (closed/private menu), fonts **Unbounded** (display/brand) + **Manrope** (body) from Google Fonts, `viewport-fit=cover` (notch/safe-area aware).
- `index.css` (2147 lines): dark theme only. Tokens in `:root`: `--bg #0a0a0a`, `--bg-card #161616`, `--text #f0ece6`, `--accent #e8363d` (red), radii `sm/md/lg/xl`, `--safe-bottom` = `env(safe-area-inset-bottom)`. Mobile-first; `.container` max-width 900px centered.

---

## 1. COMPLETE FEATURE / BEHAVIOR INVENTORY

### 1.1 Auth / Login
Files: `auth/AuthContext.jsx`, `auth/AuthGate.jsx`, `auth/LoginPage.jsx`, `auth/api.js`.

- **Session bootstrap**: on mount, `AuthProvider` calls `GET /api/auth/me`. While pending, `AuthGate` renders a blank `.login-page` (no spinner). Cookie/session based — `api` always sends `credentials: 'include'`.
- **Gated app**: if no `user`, the entire app is replaced by `<LoginPage>`. Nothing else loads (content bundle only mounts after auth passes).
- **Login form** (`LoginPage`):
  - Fields: Логин (username, `autoCapitalize/autoCorrect/spellCheck` off, `autoComplete=username`), Пароль (`type=password`, `autoComplete=current-password`).
  - Brand block "Kollektiv" + subtitle "Закрытая коктейльная карта".
  - Submit calls `login(username.trim().toLowerCase(), password)` → `POST /api/auth/login`. **Username is trimmed and lowercased before send.**
  - Validation: submit disabled unless `username.trim()` and `password` present and not already submitting.
  - Submit button label toggles "Войти" ↔ "Входим…"; whole form disabled while submitting.
  - Error handling: on failure, shows `.login-error` with `role="alert"`, message = server `detail` or fallback "Неверный логин или пароль", appended with " — попробуйте ещё раз". **Password field is cleared and auto-refocused** (a `useEffect` on `error` refocuses `passwordRef`).
  - `noValidate` on the form (JS handles validation).
- **Logout**: `logout()` → `POST /api/auth/logout` (network errors swallowed), then clears user. Wired to the footer user button.
- **Roles**: `user.role` ∈ `admin | editor | reader`. `user` object also has `id`, `username`, `name`. Role gates footer links (see 1.2) and Users page (see 1.16).
- **API error contract**: non-2xx throws `Error(detail)` with `.status`; 204 → null; JSON otherwise.

### 1.2 Global nav — burger menu, footer, routing
Files: `App.jsx`, `components/BurgerMenu.jsx`, `components/Footer.jsx`.

- **Routing is pure React state** — `App` holds `page` (`useState('menu')`). No URL/hash/history; refresh always returns to `menu`. Pages are conditionally rendered blocks.
- **Burger menu** (top-left, `BurgerMenu`):
  - Trigger button shows a hamburger icon + the **current category label** inline (`activeItem?.label || 'Меню'`).
  - Opens a **left drawer** with overlay. Body scroll locked while open (`document.body.style.overflow='hidden'`). **Esc closes**; clicking overlay closes; clicking inside `stopPropagation`.
  - Drawer head: "Kollektiv" brand + close (×) button.
  - Items are **only visible categories** from the content bundle (`categories.filter(is_visible)`), mapped to `{key: c.kind, label: c.label}`. Active item highlighted. Selecting an item calls `onSelect(kind)` and closes.
  - Note: routing keys are the category **`kind`** (stable), so an admin can rename a category label ("Меню" → anything) without breaking navigation.
- **Footer** (`Footer`, hidden when logged out):
  - Brand block "Kollektiv / Коктейльная карта".
  - "Прогресс изучения" link (all logged-in users) → ProgressPage.
  - "Управление контентом" link (role admin **or** editor) → AdminPage.
  - "Юзеры" link (role admin **only**) → UsersPage.
  - User button showing `user.name || user.username` + "Выйти ↪" → logout.
- **Page set** (`App`): `menu` (author cocktails), `classics`, `zero`, `zc`, `kitchen`, `spirits`, `progress`, `admin`, `users`. Admin/users/progress are reached via footer, not burger.
- Navigating a category resets the open cocktail sheet (`setSelected(null)`).

### 1.3 Author cocktails — "Меню" (default page)
Files: `App.jsx` (inline), `components/CocktailCard.jsx`, `components/BottomSheet.jsx`, `components/SearchBar.jsx`, `components/FilterTags.jsx`.

- **Search bar** (`SearchBar`): placeholder "Найти коктейль…", live filter, clear (×) button appears when non-empty, all autocomplete/spellcheck off. Search matches cocktail `name`, `tagline`, and any `flavors[]` (case-insensitive, trimmed).
- **Two filter rows** (`FilterTags`, horizontally scrollable pills):
  - Row 1 = **spirit filter** (`spiritFilters` from bundle: e.g. Все/Джин/Водка/Ром/Бурбон/Бренди/Мескаль). Matches against `cocktail.tags.includes(key)`.
  - Row 2 = **glass filter** (`glassFilters`: Все/Олд Фэшн/Пони Гласс/Коллинз/Рокс/Металл/Винный/Пиала/Бутылка). Matches `cocktail.glassTag === key`.
  - Active tag auto-scrolls into horizontal center (`scrollIntoView` on active ref).
  - Filters combine (AND) with search.
- **Section header**: "Basic people can't tell what it is®".
- **Card grid** (`CocktailCard`): 2-col mobile, 3-col ≥1024px. Each card:
  - Learned toggle pill (○/✓) floating top — `CardLearnedBtn kind="menu"` (see 1.11). Click is `stopPropagation` (doesn't open sheet).
  - Optional badge (top): types `premium | onesip | bottle | hot` with distinct styles + label.
  - Thumbnail whose **background color is auto-extracted from the image** (`useImageColor`, see 1.14); fallback `#111`. Image `loading=lazy`.
  - Name, tagline.
  - Flavor row: spirit label chip (first tag that maps to a spirit label), ABV chip (if `abv`), first 2 flavors, and a "+N" chip if more than 2 flavors.
  - (Dead branch: `cocktail.meta` pill rendering exists but `meta` is never populated for author cocktails — see §5.)
- **Empty state**: icon ":/" + "Такого коктейля нет, но мы можем придумать".
- **Cocktail detail sheet** (`BottomSheet`, see 1.10): opened by tapping a card.

### 1.4 Classics + families + family theory
Files: `pages/ClassicsPage.jsx`, `components/ClassicCard.jsx`, `components/ClassicSheet.jsx`, `components/ProgressPanel.jsx`.

- **Two filter rows**:
  - Family filter: "Все" + one pill per family (`families` from bundle, e.g. Sour/Daisy/Mary/Negroni & Friends/Martini-Martinez/Manhattan/Highball & Co./Spritz & Bubbles/Dessert). Selecting a family **also clears the search box**.
  - Spirit filter (hardcoded list in page): Все/Джин/Водка/Ром/Виски/Бренди/Текила/Мескаль/Аперитив. Matches `classic.spirits.includes(key)`.
- **Search** (`.classics-search-wrap`): matches classic `name`, any `descriptors[]`, or `origin`.
- **Progress button** (page-local): a card showing "Прогресс изучения", "{learned}/{total} · {pct}%", and a progress track bar. Opens the **classics-only ProgressPanel** sheet.
- **Family theory block** (shown only when a specific family is active, colored left border = family color):
  - `logic` (what unites the family), `evolution` (chain string A → B → C), `tip` (rendered with 💡 emoji). All three from the family record.
- **Classic card** (`ClassicCard`): colored via `--fc` family color. Shows year (if any), name, origin (if any), spirit pill (first spirit → label) + glass pill, first 2 descriptors joined with " · ". Learned ○/✓ button (stopPropagation).
- **Empty state**: ":/" + "Нет коктейлей с таким фильтром" (spans grid).
- **Classic detail sheet** (`ClassicSheet`): family label (colored), name, year, origin, all descriptors as chips, then sections: **Состав** (composition), **Бокал** + **Гарниш** (two-up), **История** (history), **Кому подходит** (forWhom).
  - **"Наш ответ" cross-links**: `relatedOurs[]` slugs are resolved against author `cocktails`; each shown as a button "{name} →". Clicking closes the classic sheet and **opens that author cocktail's BottomSheet** (via `onOpenAuthorCocktail` lifted to `App`). This is a cross-page interaction.
  - Learned toggle button at bottom ("✓ Знаю" / "○ Отметить как выученное").
- **Classics ProgressPanel** (`ProgressPanel`, separate from the global Progress page):
  - Header: big "{learned.size} / {total}" + "{pct}% выучено".
  - **По семействам**: per-family progress rows — name (family color), a filled bar (ratio × 100%), and a "done/total" badge colored by level: `good` (≥80%), `partial` (≥40%), `none` (<40%) with labels "Знаю хорошо / Знаю частично / Не изучено" (computed but only the count is shown in the badge).
  - **Tabs**: "Знаю ({n})" / "Не знаю ({n})". Lists classics; each row (name + glass + →) closes the panel and opens that classic's sheet. Empty-tab messages: "Ещё ничего не отмечено" / "Все выучены!".
  - Sheet max-height 85vh, body-scroll-locked, Esc/click-outside close.

### 1.5 Spirits encyclopedia — "Крепкое"
Files: `pages/SpiritsPage.jsx`, `components/SpiritCard.jsx`, `components/SpiritSheet.jsx`.

- Data: `spiritCategories` (with `slug`, `label`, `sort_order`, `is_archived`) + `spiritEntries`.
- **Archive mode toggle** (only rendered if any category `is_archived`): pills "В карте" / "Выведенные". Switching mode resets category filter to "all".
- **Category filter**: "Все" + one pill per category visible in the current mode, ordered by `sort_order`.
- **Grouping**: entries grouped by category; within a category sorted by `name.localeCompare(…, 'ru')`. Empty categories are hidden. When "Все" is active, each group renders a section header (`label`, plus " · архив" suffix if archived); when a single category is selected, the header is hidden (the active pill already names it). Categories with zero entries show empty state "В этой подкатегории пусто".
- **Spirit card** (`SpiritCard`): photo-thumb layout variant (`kitchen-card`, `--no-img` modifier when no image, fixed `#161616` bg — **no color extraction here**). Learned ○/✓ (`kind="spirits"`). Shows name, `flavour` as tagline, ABV chip ("{abv}%"), price chip.
- **Spirit detail sheet** (`SpiritSheet`): hero image (if any), name, ABV + price pills, then conditional sections: **Вкус** (flavour), **Бренд** + **Страна / регион**, **Подробно про бренд** (`brandCountry`, whitespace preserved), **Ссылка** (`sourceUrl` as external link, `target=_blank rel=noopener`), **Особенности** (features), **В коктейлях** (cocktail pairings — **BUG: reads `entry.cocktail_pairings` but the normalizer provides `entry.cocktailPairings`, so this section never renders**, see §5), **Занимательный факт** (fact). Learned toggle at bottom.

### 1.6 Kitchen — "Кухня"
Files: `pages/KitchenPage.jsx`, `components/KitchenCard.jsx`, `components/KitchenSheet.jsx`.

- Data: `kitchenCategories` (`slug`, `label`, `sort_order`) + `kitchenDishes`.
- **Grouped by category** in `sort_order`; empty categories hidden. No search, no filter pills. Section header per category. Empty overall: ":/" + "Меню кухни пока пустое."
- **Kitchen card** (`KitchenCard`): photo-thumb variant. Learned ○/✓ (`kind="kitchen"`). Name; tagline falls back to `description`; chips: price, "{weight} г", "{timing} мин".
- **Kitchen detail sheet** (`KitchenSheet`): hero (if img), name, tagline; meta pills price / "{weight} г" / "{timing} мин"; sections: **Состав** (`description`), **Сервировка** (`serving`), **Интересные факты** (`interestingFacts`), **Пищевая ценность** (`nutrition`, whitespace preserved, smaller font). Learned toggle.

### 1.7 Zero — "Безалко"
Files: `pages/ZeroPage.jsx`, `components/ZeroCard.jsx`, `components/ZeroSheet.jsx`.

- Data: `zeroCocktails`. No filter/search. Header "Без алкоголя, но всё ещё интересно". Empty: ":/" + "Пока пусто. Спросите бармена."
- **Zero card** (`ZeroCard`): photo thumb. Learned ○/✓ (`kind="zero"`). Name, tagline; chips: price, ABV chip that **falls back to "Non Alc"** when `abv` empty, glass.
- **Zero detail sheet** (`ZeroSheet`): hero, name, tagline; pills price / ABV(or "Non Alc") / glass; **В составе** = bulleted `ingredients[]` list; then arbitrary `details[]` label/text blocks. Learned toggle.

### 1.8 Zero Culture — "ZC"
Files: `pages/ZCPage.jsx`, `components/ZCCard.jsx`, `components/ZCSheet.jsx`.

- Data: `zcDrinks` with `isAlcoholic`, `caffeineLevel`, `isCarbonated`, price, abv, glass, details.
- **Filter pills**: Все / Алко / Non Alc (`isAlcoholic` boolean split).
- Header "Zero Culture" + sub "Тюнингованная подача, переосмысленная знакомая упаковка". Empty: "Пока пусто."
- **ZC card** (`ZCCard`): photo thumb. Learned ○/✓ (`kind="zc"`). **Alc/Non-Alc badge** (top). Name, tagline; chips: price, abv, glass, and for **non-alcoholic only**: "кофеин {level}/3" (if `caffeineLevel != null`) and "газ" / "без газа" (from `isCarbonated true/false`; nothing if null).
- **ZC detail sheet** (`ZCSheet`): hero; a "Zero Culture · Алко/Non Alc" tag; name, tagline; pills price/abv/glass; for non-alc: a **caffeine dot meter** (`CaffeineBar` — 3 dots + "{level}/3") and a **carbonation indicator** ("◉ Газированный" / "◯ Без газа" when `isCarbonated != null`); then `details[]` blocks. Learned toggle.

### 1.9 Learning progress — "знаю" toggles (cross-cutting)
Files: `data/useProgress.jsx`, `components/CardLearnedBtn.jsx`, `components/LearnedToggle.jsx`.

- Every content item across all six kinds can be marked **learned/"знаю"** by the current user.
- Two UI affordances: floating card pill `CardLearnedBtn` (○/✓, `aria-label` "Отметить как знакомое"/"Снять отметку") and in-sheet button `LearnedToggle` ("○ Отметить как знакомый" / "✓ Знаю"). Classics use their own inline variants with same visual language.
- **Kinds**: `menu` (author cocktails), `classics`, `spirits`, `kitchen`, `zero`, `zc`.
- Optimistic: toggling updates local Set immediately; on API failure it **rolls back**.
- **Legacy migration**: on first load, any `localStorage['classics_learned']` array is pushed to the server (`POST /api/me/progress/classics/{slug}` for each) then the localStorage key is removed. One-time.

### 1.10 Cocktail detail sheet (BottomSheet — author cocktails)
File: `components/BottomSheet.jsx`.

- Bottom-sheet modal. Body scroll locked; **Esc closes**; **click outside the sheet closes** (ref-contains check); explicit × close button.
- Hero image with **auto-extracted background color** (`useImageColor`).
- Name, tagline; (dead `meta` pills branch); all flavors as chips; divider; then each `details[]` block (label + text); learned toggle at the end.
- Shared visual: `.sheet-wrapper`, `.sheet-container` (max-width 500px ≥640px), `.sheet`, `.sheet-hero`, `.sheet-body`.

### 1.11 Search & filters (summary of where each exists)
- **Author menu**: text search (name/tagline/flavors) + spirit pills + glass pills.
- **Classics**: text search (name/descriptors/origin) + family pills + spirit pills.
- **Spirits**: archive-mode pills (conditional) + category pills. No text search.
- **ZC**: Alc/Non-Alc pills. No text search.
- **Kitchen / Zero**: no search, no filters.
- `FilterTags` behavior: horizontal scroll, active pill auto-centers.

### 1.12 Progress page (global) — footer "Прогресс изучения"
File: `pages/ProgressPage.jsx`.

- Aggregates progress across all kinds via `KIND_CONFIG` mapping: `menu→Меню/cocktails`, `classics→Классика/classics`, `spirits→Крепкое/spiritEntries`, `kitchen→Кухня/kitchenDishes`, `zero→Безалко/zeroCocktails`, `zc→Zero Culture/zcDrinks`.
- Per kind: intersects the user's learned slugs with **currently existing** item ids (guards against stale slugs in DB), computes `learnedCount/total` and pct. Kinds with 0 total are dropped.
- **Overall**: "Изучено {X} из {Y} позиций — {pct}%" + an overall progress bar.
- **Per-kind cards** (`progress-card`, clickable): label, "{learned}/{total}", fill bar, pct. **Clicking a card navigates to that category page** (`onOpenCategory(kind)` → sets `App.page`). Empty overall: "Пока нет контента для отслеживания".
- **Per-kind learned lists**: for each kind with ≥1 learned, a compact list of learned item names under "{label} · знаю".

### 1.13 History / timeline
- The content bundle carries a `timeline` field (`data.timeline` → `bundle.timeline`) and `index.css` has a full `.classics-timeline*` style block. **However, NO component currently renders the timeline** — it is fetched but unused in the live UI (dead/latent feature). A static `COCKTAIL_TIMELINE` array also exists in `data/classics.js` (dead legacy file, see §5). If "history timeline" is expected in the rebuild, note it must be **re-added** (data + CSS already exist; the JSX was removed/never wired).

### 1.14 Notable UX details worth preserving
- **`useImageColor` hook** (`hooks/useImageColor.js`): loads the image (`crossOrigin=anonymous`), draws to a canvas, samples pixel (5,5), and uses that rgb as the thumbnail/hero background so each card/hero blends with its logo. Fallback `rgb(17,17,17)` on error/CORS. Used by author cocktail cards + BottomSheet hero (NOT by photo-based spirit/kitchen/zero/zc thumbs, which use fixed `#161616`).
- **Bottom sheets** everywhere: consistent open/close model — body scroll lock, Esc, click-outside-to-close, × button, hero image full (no crop), max 500px on desktop.
- **Flash-card learning**: ○/✓ toggles on cards and in sheets; optimistic with rollback.
- **Family-colored theming** on classics (per-family accent color drives card border, sheet family label, progress bars).
- **Filter pill auto-centering**; **search auto-clear** button; **classics search resets on family change**.
- **Safe-area/notch awareness** (`env(safe-area-inset-*)`), card entrance animation (`cardIn` fade+slide), tap highlight removed, `-webkit-user-select:none` on cards.
- **Editors are dirty-aware** (see 1.15): confirm-on-close + `beforeunload` guard.
- **Cross-links**: classic → related author cocktail opens across sections.
- Login **auto-refocus + password clear** on error.

### 1.15 Admin CRUD (content management) — footer "Управление контентом"
Files: `admin/AdminPage.jsx`, `admin/FormFields.jsx`, `admin/useEditorClose.js`, and per-type editors. Gate: role admin **or** editor.

- **Sub-tabs** with live counts: Меню·{n}, Классика·{n}, Безалко·{n}, Zero Culture·{n}, Кухня·{n}, Крепкое·{n}, Категории.
- **List rows** everywhere: name + sub-line (id and type-specific meta) + "Изменить" / "Удалить" buttons. Delete uses `confirm("Удалить «name»? Это действие необратимо.")` then `DELETE /api/admin/{kind}/{id}` and `reload()`; errors `alert(...)`. A global `busy` flag disables buttons during delete.
- **Editors** open as bottom-sheet forms; each supports create (empty) and edit (prefilled via `editing._kind`). On save: `PATCH /api/admin/{type}/{id}` (edit) or `POST /api/admin/{type}` (create), then `onSaved()` (reload content bundle) and close.
- **Dirty-aware close** (`useEditorClose`): captures a JSON baseline of the form on mount; Esc / click-outside / Cancel run `safeClose` which prompts "Есть несохранённые изменения…" if changed; also installs a `beforeunload` guard. Successful submit bypasses the confirm.

Shared form primitives (`FormFields.jsx`):
- `TextField`, `TextArea`, `NumberField` (empty → null, integer parse), `SelectField` ("— нет —" → null, `allowEmpty` toggle), `ColorField` (native color picker + hex input), `ImageField` (see 1.17), `ChipsField` (tokenized multi-value with datalist autocomplete; Enter/comma add, Backspace-on-empty removes last, blur commits, de-dupes), `ParagraphsField` (repeatable {label,text} blocks with reorder ↑/↓ and delete, "+ Добавить блок").

Per-type editor fields:
- **CocktailEditor** (`/api/admin/cocktails`): slug, name, img (ImageField), abv, glass (SelectField from glassFilters), badge (premium/onesip/bottle/hot — sends both `badge_key` and derived `badge_label`), tagline, tags (Chips + suggestions from existing tags), flavors (Chips + suggestions), details (ParagraphsField). Validates slug+name. Empty details blocks filtered out.
- **ClassicEditor** (`/api/admin/classics`): slug, name, family (Select from families, required), year (Number), origin, spirits (Chips; canonical list gin/vodka/rum/whiskey/brandy/tequila/mezcal/other/bourbon), composition, glass (Select, union of glassFilters + glasses seen on classics), garnish, descriptors (Chips + suggestions), history, for_whom, related_ours (Chips of author-cocktail slugs; hint resolves slug→name live). Validates slug+name+family.
- **FamilyEditor** (`/api/admin/families`): key, label, sub, color (ColorField), logic, evolution, tip. Validates key+label. (Create via "+ Семейство" on the Классика tab.)
- **ZeroEditor** (`/api/admin/zero-cocktails`): slug, name, img, price, abv (default "Non Alc"), glass, tagline, ingredients (textarea, one per line → `ingredients_text`), details.
- **ZCEditor** (`/api/admin/zc-drinks`): slug, name, img, **type toggle Алко/Non Alc** (`is_alcoholic`), price, abv/format, glass, `glass_label_override` (free-text when no preset fits), tagline, and for non-alc only: caffeine level (1–3) + carbonation tri-state (Да/Нет/—). Caffeine/carbonation forced null when alcoholic. Details blocks.
- **KitchenEditor** (`/api/admin/kitchen-dishes`): slug, category (Select, required, defaults to first), name, img ("Эталон подачи"), price, tagline (site description), description (Состав), timing, weight, nutrition, serving, interesting_facts.
- **SpiritEditor** (`/api/admin/spirit-entries`): slug, category (Select, required; archived categories shown with " · архив"), name, img, abv, price, flavour, brand, country, brand_country ("Подробно про бренд"), source_url, features, cocktail_pairings, fact.
- **UserEditor**: see 1.16.

### 1.16 Categories management
Files: `admin/CategoriesTab.jsx` (nav categories), `admin/KitchenCategoryRow.jsx`, `admin/SpiritCategoryRow.jsx` (per-domain categories inside their admin tabs).

- **Nav categories** ("Категории" sub-tab, `CategoriesTab`): loads `GET /api/admin/categories` (sorted by `sort_order`). Per row: inline **rename** (blur/Enter commits → `PATCH /api/admin/categories/{key}` with label/sort_order/is_visible), **reorder** ↑/↓ (renumbers and `POST /api/admin/categories/reorder` with ordered keys), **show/hide** toggle (`is_visible` — hidden categories drop out of the burger). Shows `key` and `kind` in the sub-line. Categories are structural (kind fixed in code) but label/order/visibility are editable. All saves call `onSaved()` (bundle reload) so the burger updates.
- **Kitchen categories** (inside Кухня tab): "+ Категория" uses two `prompt()`s (label, then slug auto-suggested from label) → `POST /api/admin/kitchen-categories` (with `sort_order = count`). Per-category `KitchenCategoryRow`: inline rename (`PATCH …/kitchen-categories/{slug}`), delete (× — blocked with alert if `dishCount>0`; confirm then `DELETE`). Count badge.
- **Spirit categories** (inside Крепкое tab): "+ Категория" via prompts → `POST /api/admin/spirit-categories` (with `is_archived:false`). Per-category `SpiritCategoryRow`: inline rename, **archive toggle** ("В карте" ↔ "Архив", `PATCH is_archived`), delete (blocked if `entryCount>0`). Count badge.
- **Families** act as classics' categories (create/edit via FamilyEditor; delete via AdminPage's Классика tab, **blocked while the family still has classics** — the × is disabled with tooltip "Сначала перенесите коктейли").

### 1.17 Image uploads
File: `admin/FormFields.jsx` → `ImageField`; `auth/api.js` → `upload`, `resolveImageUrl`.

- Every content editor with an image uses `ImageField`: shows a preview (if value), a **manual path text input** (placeholder `/static/img/file.webp или /logos/file.webp`), an "Загрузить файл" button, and "Очистить".
- Upload: hidden `<input type=file accept="image/webp,image/jpeg,image/png,image/avif">` → `POST /api/admin/uploads/image` as `multipart/form-data` (field `file`) → stores returned `{url}` into the field. Uploading/error states shown ("Загружаю…", inline error). Hint mentions webp/jpg/png/avif up to 5 MB.
- **`resolveImageUrl`**: leaves `http(s)://…` and legacy `/logos/…` paths unchanged; prepends `VITE_API_URL` origin to `/static/…` paths (so images resolve when frontend and backend are on different domains).

### 1.18 User management — footer "Юзеры" (admin only)
Files: `admin/UsersPage.jsx`, `admin/UserEditor.jsx`.

- Lists users (`GET /api/admin/users`): each row shows role badge (`admin-role--{role}`), name/username, "@username", and "· это вы" for the current user.
- Create ("+ Новый юзер") / Edit ("Изменить") / Delete ("Удалить").
- **Delete** confirm + `DELETE /api/admin/users/{username}`. **Cannot delete yourself** (button disabled, tooltip "Нельзя удалить себя").
- **UserEditor**: fields username (create only; lowercased on save; on edit it's locked with hint "логин менять нельзя"), name, role (Select: admin/editor/reader), password (required on create ≥4 chars per hint; on edit blank = "don't change"). Create → `POST /api/admin/users`; edit → `PATCH /api/admin/users/{username}` (password only sent if provided). Dirty-aware close.

---

## 2. DATA FLOW

- **Content loading is a single bundled endpoint**: `GET /api/content` (`data/ContentContext.jsx`). One request returns everything: `categories, cocktails, classics, families, zero_cocktails, zc_drinks, kitchen_categories, kitchen_dishes, spirit_categories, spirit_entries, cocktail_spirit_filters, cocktail_glass_filters, timeline`.
  - The provider **normalizes snake_case → camelCase** into the shape components consume (`normaliseCocktail/Classic/Zero/ZC/Dish/Spirit`). Backend field mapping is explicit there (e.g. `glass_tag→glassTag`, `is_alcoholic→isAlcoholic`, `caffeine_level→caffeineLevel`, `brand_country→brandCountry`, `interesting_facts→interestingFacts`, `related_ours→relatedOurs`, badge `{key,label}→{type,label}`).
  - `families` and `spiritFilters`/`glassFilters` are passed through as-is (filters keep backend `{key,label}` shape).
- **Gating** (`main.jsx` provider tree): `AuthProvider → AuthGate → ContentProvider → ContentGate → ProgressProvider → App`. `ContentGate` blocks the first load ("Загружаем карту…") and shows a retry card on first-load error, but **keeps the UI mounted on subsequent `reload()`s** (so admin edits don't reset `App.page`).
- **Auth/session**: cookie-based; every request uses `credentials:'include'`. `GET /api/auth/me` bootstraps; `POST /api/auth/login|logout`. No tokens in JS/localStorage.
- **Progress persistence** (`data/useProgress.jsx`): `GET /api/me/progress` returns `{kind: [slugs]}`; toggles are `POST`/`DELETE /api/me/progress/{kind}/{slug}` (optimistic + rollback). Progress is per-user, server-side.
- **Admin edits**: REST under `/api/admin/*` (`POST` create, `PATCH /{id}` update, `DELETE /{id}`), image upload at `/api/admin/uploads/image`, category reorder at `/api/admin/categories/reorder`. After any mutation the client calls `reload()` to re-fetch `/api/content` (no partial cache updates). **Delete-kind path segments differ from tab keys**: cocktails, classics, families, `zero-cocktails`, `zc-drinks`, `kitchen-dishes`, `kitchen-categories`, `spirit-entries`, `spirit-categories`, categories, users.
- **Config**: `VITE_API_URL` (empty string = same origin) prefixes all requests and `/static/` image URLs.

## 3. ROUTING / NAVIGATION MODEL

- **No router.** Navigation is `App`'s `page` state string. No URLs, no deep links, no browser back/forward, no hash. Reload → always `menu`.
- **Sheets/modals are local component state** (`selected`, `showProgress`, `editing`, `creating`) — not routes.
- **Public sections** switch via the burger (only `is_visible` categories, keyed by `kind`). **Admin surfaces** (admin, users, progress) switch via footer links.
- **Mobile vs desktop** is purely CSS (`index.css`): base is mobile; `@media (min-width:640px)` widens grid gutters and caps sheet width at 500px; `@media (min-width:1024px)` switches the card grid to 3 columns. Same DOM/behavior otherwise (burger drawer is used at all widths). Safe-area insets handled for notched devices.

## 4. NOTABLE UX DETAILS TO PRESERVE
(See 1.14 for the full list.) Highest-value: image-color extraction for card/hero backgrounds; the uniform bottom-sheet interaction model (scroll-lock + Esc + click-outside + hero-no-crop); per-user learned/"знаю" flash-card toggles with optimistic rollback; family-colored classics theming and per-family progress bars; classic→author-cocktail cross-links; two distinct progress surfaces (global ProgressPage + classics-only ProgressPanel); dirty-aware editors with unsaved-changes guard; filter-pill auto-centering; login refocus-and-clear on error; ChipsField and ParagraphsField editing ergonomics; ZC caffeine dot-meter + carbonation indicator; archive mode for spirits.

## 5. CODE-QUALITY NOTES (brief — frontend is being replaced)

- **Real bug — spirit "В коктейлях" never renders**: `SpiritSheet.jsx` reads `entry.cocktail_pairings`, but `ContentContext` maps it to `entry.cocktailPairings`. Data is fetched and editable in admin but invisible on the site. The rebuild should surface this field.
- **Latent/removed feature — history timeline**: `timeline` is fetched into the bundle and full `.classics-timeline*` CSS exists, but no JSX renders it. If the timeline is considered an existing prod feature, it must be explicitly rebuilt.
- **Dead legacy files**: `data/cocktails.js` and `data/classics.js` (static seed arrays incl. `spiritFilters`, `glassFilters`, `classicFamilies`, `COCKTAIL_TIMELINE`, full cocktail/classic content) are **not imported anywhere** — all data now comes from `/api/content`. Safe to ignore, but they are a good reference for the canonical content shape and the (currently unused) timeline copy.
- **Dead `meta` rendering**: `CocktailCard` and `BottomSheet` render a `cocktail.meta` pill row, but `normaliseCocktail` never sets `meta` — dead branch (leftover from an earlier design that also served zero/kitchen-style price pills).
- **Minor**: `NumberField` imported but unused in `CocktailEditor`; `sort_order` is hardcoded to 0 in most item editors (only categories actually reorder); reliance on `prompt()`/`confirm()`/`alert()` for category create and all destructive actions; no toast system; no client-side form field-level validation beyond required slug/name; `React.StrictMode` double-invokes effects in dev (migration/logout are idempotent enough). None of these block a faithful rebuild.
- Overall the code is clean, consistent, and small; the main rebuild risks are the **two invisible-but-expected features** (spirit pairings, timeline) and making sure every learned-`kind`, filter, and sheet section above is reproduced.

---

### Backend field dependencies quick-reference (per item, camelCase as consumed)
- **Cocktail**: id, name, img, abv, glass, glassTag, tagline, tags[], flavors[], details[{label,text}], badge{type,label}.
- **Classic**: id, name, family, year, origin, spirits[], composition, glass, glassTag, garnish, descriptors[], history, forWhom, relatedOurs[] (author cocktail slugs).
- **Family**: key, label, sub, color, logic, evolution, tip (+ sort_order).
- **Spirit entry**: id, categorySlug, name, img, abv, price, flavour, brand, country, brandCountry, sourceUrl, features, cocktailPairings, fact.
- **Spirit category**: slug, label, sort_order, is_archived.
- **Kitchen dish**: id, categorySlug, name, img, price, tagline, description, timing, weight, nutrition, serving, interestingFacts.
- **Kitchen category**: slug, label, sort_order.
- **Zero**: id, name, img, price, abv, glass, glassTag, tagline, ingredients[], details[].
- **ZC**: id, name, img, isAlcoholic, price, abv, glass, glassTag, tagline, caffeineLevel, isCarbonated, details[].
- **Nav category**: key, kind, label, sort_order, is_visible.
- **User**: id, username, name, role (admin|editor|reader).
- **Filters**: cocktail_spirit_filters[], cocktail_glass_filters[] as {key,label}.
