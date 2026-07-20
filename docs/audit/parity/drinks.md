# Drinks parity audit — `cocktails` + `zero_cocktails` + `zc_drinks` → `drinks`

**9 findings: 4 high / 3 med / 2 low.** Row-level merge integrity is clean (26 = 24 + 1 + 2 − 1 Upcykle dup, verified in DB; no drop, no double-count). The problems are all in the *serialization/rendering* layer, not the ETL's row-copying: a whole relationship (`drink_spirits`) is never populated, the merge doesn't renumber `sort_order` across the three legacy namespaces, and a few rendering assumptions (hero photo, ABV fallback, whitespace) don't hold for the data actually migrated.

Method: read `backend/app/models.py`, `backend/migration/{load,parsers,source}.py`, `backend/app/{routers/content.py,schemas.py}`, `frontend/src/data/{bundle.ts,mapBundle.ts}`, `frontend/src/pages/cocktail-guide/{data.ts,views.tsx,detail-sheet.tsx}`; old frontend via `git show main:frontend/src/components/{CocktailCard,BottomSheet}.jsx` and `main:frontend/src/data/ContentContext.jsx`; live queries against both `SRC_DATABASE_URL` (prod, read-only) and `DEST_DATABASE_URL` (v2 dev); the captured `bundle.json` snapshot for exact wire values.

---

## HIGH

### D1 — `DrinkSpirit` never populated → spirit chip and spirit filter are gone for every drink
- **Old location:** `cocktail_tags` → `tags` (keys `gin/vodka/rum/bourbon/brandy/mezcal`). Old UI: `CocktailCard.jsx`'s `SPIRIT_LABELS` map renders the **first matching tag** as a spirit chip; `FilterTags` row 1 (`cocktail_spirit_filters`) filters by it.
- **New location:** `models.py` defines `DrinkSpirit` (drink_id, spirit_id) and `content.py`'s `_serialize_drink` reads `d.spirits` into `DrinkOut.spirit`/`spirits`/(first half of) `descriptors`; `bundle.filters.spirits` is built the same way. But `load.py` step 7 only copies `cocktail_tags` into `DrinkTag`/`DrinkFlavor` — **no code path writes `DrinkSpirit` at all.**
- **Verified scope (all 26 drinks):** `SELECT count(*) FROM drink_spirits` on DEST = **0**. Every one of the 24 `cocktails`-origin drinks has **exactly one** spirit-type tag, always at `sort_order 0` (i.e., unambiguous, no author drink is spirit-less or multi-spirit):

  | slug | expected spirit | slug | expected spirit | slug | expected spirit |
  |---|---|---|---|---|---|
  | dieter | Джин | pussypower | Водка | takeshi | Джин |
  | gentlecloud | Джин | jungledaiquiri | Ром | nitrorussian | Водка |
  | braindead | Джин | twofacenegroni | Джин | zyzzyva | Джин |
  | jjang | Джин | undressednegroni | Джин | mezcalnegroni | Мескаль |
  | springer | Джин | duchesse | Бурбон | upcyklecola | Ром |
  | pornstar | Водка | vikingmule | Водка | kampfire | Ром |
  | rocketboy | Бренди | bigapple | Бурбон | frappuccino | Водка |
  | candy | Водка | liveinclover | Джин | peachbuster | Бурбон |

  The 2 non-`cocktails`-origin drinks (`gaslight_americano`, `gaba`) correctly have **no** spirit (never had `cocktail_tags`).
- **Live confirmation:** `bundle.filters.spirits = []` in the captured bundle (should be 6 entries: Джин/Водка/Ром/Бурбон/Бренди/Мескаль); every drink's `spirit`/`spirits` field is `""`/`[]`; `MenuView`'s `axis="SPIRIT"` filter row renders only the "Все" pill.
- **Classification:** LOSS (relationship never populated) — but note the source signal isn't destroyed: `drink_tags` (which *is* fully migrated, 63/63 rows) still carries the same `key` strings (`gin`,`vodka`,… identical to `spirits.key`), so this is cheaply recoverable.
- **Severity:** HIGH — a whole filter axis is empty and every card/detail loses its spirit identity, exactly as flagged in the audit brief.
- **Suggested fix:** in `load.py` step 7, alongside `DrinkTag`, also insert `DrinkSpirit` rows for any `cocktail_tags` row whose `tag.key` matches a `spirits.key`. **Watch out when fixing:** 14 of 24 cocktails (`dieter, gentlecloud, braindead, jjang, springer, bigapple, liveinclover, jungledaiquiri, twofacenegroni, undressednegroni, duchesse, takeshi, mezcalnegroni, upcyklecola`) also carry their spirit's name as a plain **flavor** (e.g. cocktail `dieter` has flavor "Джин" in addition to tag "gin"). `detail-sheet.tsx`'s `FlavorChips` already de-dupes flavors against `spirits` before rendering, but `views.tsx`'s `MenuView` card grid (`descriptors.slice(0,3).join(" · ")`) does **not** — fixing `DrinkSpirit` alone will make ~14 cards show the spirit name twice ("ДЖИН · ДЖИН · …") unless the same de-dup is applied there.

### D2 — Detail-sheet hero photo never renders for any of the 26 drinks
- **Old location:** `BottomSheet.jsx`'s `.sheet-hero` — the cocktail's single `img` rendered **full-width** at the top of the sheet, with `useImageColor` extracting a background tint from it. This was a signature visual (§1.14 of the frontend inventory).
- **New location:** `Drink.photo` (`models.py`) / `DrinkOut.photo` / `Cocktail.photo` — rendered by `detail-sheet.tsx`'s `<Photo>` (4:3, `aspect-[4/3]`) in both mobile body and desktop left column, gated on `c.photo` being truthy. `load.py` never sets `photo` in any of the three `_upsert_drink` calls (only `img`→`logo`) — prod never had a second "detail photo" column, so this field is permanently `NULL` for all 26 drinks. Confirmed: every drink in `bundle.json` has `"photo": null`.
- **What actually shows instead:** only a small **140×60 (mobile) / 160×70 (desktop)** thumbnail of `c.logo` next to the name in the header — the same asset, far less prominent, and without the color-extraction treatment.
- **Classification:** RENDER-GAP (kit was designed for a second, richer detail-photo asset that prod never produced; the only asset that exists — `img`/`logo` — isn't routed into it).
- **Severity:** HIGH — affects the detail view of every single migrated drink (26/26); a visually prominent, previously-signature element (full-bleed color-matched hero) is gone, replaced by a small header thumbnail.
- **Suggested fix:** either map `d.img` into both `logo` and `photo` in `mapBundle.ts`/`content.py` (so the existing asset fills the big hero slot too), or have `detail-sheet.tsx` fall back to rendering `c.logo` at full width when `c.photo` is absent.

### D3 — Alcoholic drink with unrecorded ABV shows a false "0% ABV"
- **Old location:** `cocktails.abv = NULL` for `undressednegroni` (id 15) — the field was simply never filled in. Old `CocktailCard.jsx`: `{cocktail.abv && <span>{cocktail.abv}</span>}` — blank abv ⇒ **chip omitted entirely**, no claim made either way.
- **New location:** DEST `drinks.abv = NULL`, `abv_raw = NULL`, `is_alcoholic = true` (correctly defaulted per `load.py`'s "cocktails are alcoholic unless proven otherwise" rule — this part is right). But `mapBundle.ts`'s `mapCocktail`: `abv: d.abv ?? 0`, and both `detail-sheet.tsx`'s `Meta` (`parts.push(isAlcoholic ? \`${abv}% ABV\` : "0%")`) and `views.tsx`'s `MenuView` card meta (`c.isAlcoholic ? \`${c.abv}%\` : "0%"`) only branch on `isAlcoholic`, not on "is abv known." Net result: **"0% ABV"** is shown on both the card and the detail sheet for "Undressed Negroni" — an alcoholic gin/Negroni variant — which reads as "non-alcoholic," the opposite of reality.
- **Example:** slug `undressednegroni`, confirmed in `bundle.json`: `"abv": null, "isAlcoholic": true`.
- **Classification:** FORMAT (fallback conflates "unknown" with "zero").
- **Severity:** HIGH — factually wrong, user-visible content on a live menu card, and the failure mode (blank abv defaulting to a confident "0%") will recur for any future drink whose ABV isn't filled in yet.
- **Suggested fix:** only render the `%` chip when `abv != null`; keep `isAlcoholic ? … : "0%"` solely for genuinely-non-alcoholic drinks (where `abv` is legitimately absent by definition).

### D4 — Merging three independent `sort_order` counters scrambles the curated menu order
- **Old location:** `cocktails.sort_order` (0–23), `zero_cocktails.sort_order` (its own counter, starts at 0), `zc_drinks.sort_order` (its own counter, starts at 0) — each was a **separate page** in the old UI ("Меню" / "Безалко" / "Zero Culture"), so the three counters never collided.
- **New location:** `content.py`'s `GET /api/content` orders the merged `drinks` table by `Drink.sort_order, Drink.name` — a single shared axis now, but `load.py` copies each source's `sort_order` **verbatim**, with no renumbering across sources.
- **Concrete effect (from `bundle.json`, positions 0–3 of the merged "Авторские" list):**
  ```
  0  dieter               (cocktails sort_order 0)
  1  gaslight_americano   (zero_cocktails sort_order 0 — its own, unrelated page before)
  2  gaba                 (zc_drinks sort_order 0 — its own, unrelated page before)
  3  gentlecloud          (cocktails sort_order 1)
  ```
  "Gaslight Americano" and "Габа." — a non-alcoholic soda-twist and a barely-described caffeine drink that each used to live on their own dedicated tab — now sit at positions **#2 and #3** of the unified menu, ahead of **22 of the 24** real authored cocktails, purely because their independent counters both happen to start at 0 and the tie is broken alphabetically.
- **Classification:** FORMAT (ordering).
- **Severity:** HIGH — this is the very first thing a user sees on the merged "Меню" page, and it's not the bar's intended curation; it will get worse as more zero/zc items are added (each new item starting its own counter at/near 0 and jumping toward the front).
- **Suggested fix:** renumber at merge time — e.g. offset `zero_cocktails`/`zc_drinks` sort_order ranges to start after `max(cocktails.sort_order)`, or make an explicit product call on where non-alcoholic items should sit in the unified list (interleaved by some other key, or appended at the end).

---

## MED

### D5 — Upcykle Cola dedup preserves all content but shows it twice, overlapping
- **Old location:** the same product existed as `cocktails` id 22 (`upcyklecola`, 3 `cocktail_details` rows) **and** `zc_drinks` id 2 (`upcykle_cola`, 4 `zc_drink_details` rows) — two separate menu entries on two separate pages (§3.7 of `docs/audit/details/database.md`).
- **New location:** `load.py` step 4 dedups by normalized slug, keeping the `cocktails`-origin drink and merging **both** detail sets into it (step 6 adds `cocktail_details` then `zc_drink_details` for the same `drink_id`). Row count checks out exactly: `35 + 2 + 6 + 1 (glass rescue) + 1 (ingredients rescue) = 45 = drink_details` total in DEST. Nothing is dropped.
- **But the merged content is genuinely duplicative**, not just doubled in count — confirmed via `bundle.json`'s `details[]` for `upcyklecola`:
  - Two different-length **"Что такое Upcykle™?"** blocks back-to-back (318 chars, then 620 chars) — same explanation told twice, in different words.
  - **"О коктейле"** (344 chars, from `cocktails`) and **"Про сам коктейль"** (262 chars, from `zc_drinks`) are near-paraphrases of each other ("Твист на Ром Колу. Кола доведена до «пряной Колы»…" vs "…это наш твист на Ром Колу. Мы довели Колу до «пряной Колы»…").
  - **"На обратной этикетке"** appears twice: once with a Russian translation (465 chars) and once as just the bare English quote repeated (173 chars, a literal substring of the first).
- **Classification:** FORMAT (dedup/consolidation quality — not a loss, both sources fully present).
- **Severity:** MED — confusing but only affects 1 of 26 drinks.
- **Suggested fix:** when the Upcykle-style dedup fires, either drop one source's detail set (prefer the more complete `zc_drink_details` set) or flag the pair for manual editorial consolidation instead of auto-concatenating.

### D6 — Badge descriptive labels dropped; "250ml" serving info has no home
- **Old location:** `badges` table has both `key` and `label` (`bottle`→"Bottle 250ml", `hot`→"Горячий", `onesip`→"Onesip", `premium`→"Премиум"). Old `CocktailCard.jsx` rendered `cocktail.badge.label` verbatim.
- **New location:** `badges` table (key+label) is migrated 1:1 into DEST (`s.merge(m.Badge(...))`, confirmed present), but `content.py`'s `_serialize_drink` only emits `badge=d.badge.key.upper()` — `Badge.label` is **never read** anywhere in the API. `DrinkOut.badge`/`Cocktail.badge` is a bare code string.
- **Concrete loss:** for `upcyklecola` (badge "Bottle 250ml" in prod), the new UI shows only **"BOTTLE"** — the "250ml" serving-size information is gone, and it isn't recoverable anywhere else (`Drink.volume_ml` is also never populated by the ETL for any drink).
- **Side note (cosmetic, not a data issue):** the emitted code is "BOTTLE" (from `badges.key='bottle'`), but the frontend's own contract (`data.ts`'s `MenuBadge` type and the comment in `mapBundle.ts`) documents the canonical codes as `"HOT" | "BOTTLED" | "PREMIUM" | "ONESIP"` — i.e. even the intended redesign expected "BOTTLED", not "BOTTLE". No runtime break (the string flows through untyped), just a stray mismatch.
- **Classification:** STRANDED (`badges.label` migrated, unused) + a genuine content loss (the "250ml" fact has no other home).
- **Severity:** MED — narrow (1 badge instance affected today: `upcyklecola`), but a real, specific piece of information disappears.
- **Suggested fix:** either expose `badge: {key, label}` in `DrinkOut` (matching how `_serialize_classic`/others could) and have the kit show the label text, or fold serving-size into `volume_ml` during ETL for badge types that imply one (e.g. "Bottle 250ml" → `volume_ml=250`).

### D7 — Embedded newlines collapse to run-on prose (no `white-space` CSS anywhere)
- **Old location:** `zero_cocktails.ingredients_text` for `gaslight_americano` — 3 ingredient lines separated by `\n`, rendered by the old `ZeroSheet` as a **bulleted `<ul>` list** (backend pre-split it into an `ingredients[]` array). Similarly, several `cocktail_details`/`zc_drink_details` prose blocks use `\n\n` for paragraph breaks.
- **New location:** the `ingredients_text` rescue (`load.py`, label "Ингредиенты") stores the raw text **with literal `\n` characters intact** as a single `DrinkDetail.text` value — confirmed in `bundle.json`: `"text": "Red Bitter от NoTails\nКордиал из каркаде и перца кубеба\nМалиновая пена из Gentle Cloud"`. `detail-sheet.tsx`'s `Section` renders it in a plain `<span className="leading-[1.55] ...">` — grepped the whole `frontend/src` tree for `white-space`/`whitespace-pre*`: **zero matches**. Default CSS `white-space: normal` collapses `\n` to nothing, so this renders as one run-on sentence instead of 3 distinct ingredients.
- **Scope:** 4 of 45 migrated `drink_details` rows contain embedded newlines, across 2 drinks: `gaslight_americano` ("Про название", "Ингредиенты") and `upcyklecola` ("Что такое Upcykle™?", "На обратной этикетке").
- **Classification:** RENDER-GAP / FORMAT.
- **Severity:** MED — narrow today (2/26 drinks) but will recur for any future multi-paragraph or multi-line detail content, and the "Ингредиенты" case specifically degrades a previously-structured bulleted list into unstructured prose.
- **Suggested fix:** add `whitespace-pre-line` (or `pre-wrap`) to the `Section`/detail text spans in `detail-sheet.tsx`.

---

## LOW

### D8 — Glass filter pill order is no longer curated
- **Old location:** old glass filter pills (`cocktail_glass_filters`) followed the `glasses` dictionary's own `sort_order` (a deliberately curated order: Олд Фэшн/Пони Гласс/Коллинз/Рокс/Металл/Винный/Пиала/Бутылка).
- **New location:** `content.py`: `menu_glasses = _distinct(d.glass.label for d in drinks if d.glass)` — order is "first appearance walking `drinks` in `drink.sort_order` order," which (compounded by D4's ordering bug) currently produces a different, less-intentional sequence: `["Олд Фэшн","Винный","Пони Гласс","Металл","Коллинз","Рокс","Пиала","Бутылка"]` (confirmed in `bundle.json`).
- **Classification:** FORMAT (ordering only — all 8 glass labels present, nothing lost).
- **Severity:** LOW — cosmetic pill order, not content.
- **Suggested fix:** derive `filters.glasses` from the `glasses` lookup table's own `sort_order`, filtered to glasses actually in use, instead of from first-appearance-in-`drinks`.

### D9 — Card descriptor semantics changed (design evolution, not data loss)
- **Old location:** `CocktailCard.jsx` showed: spirit chip (from tag) + ABV chip + **first 2 flavors** + a "+N" overflow chip if more remained.
- **New location:** `MenuView`'s `MediaCard` shows a single combined string: **first 3** `descriptors` (spirits+flavors, once D1 is fixed) joined by " · ", with **no overflow indicator** when there are more than 3, and ABV moved into the separate `meta` line (price/volume/abv) rather than an inline flavor-row chip.
- **Classification:** FORMAT (presentation redesign — all underlying data still reaches the bundle; this is the kit's new visual language, consistent with how classics/spirits render elsewhere in the same file).
- **Severity:** LOW — a user would notice the layout differs, but no information is hidden or lost (ABV is still shown, just relocated; "+N more" is simply omitted, everything ≤3 is exact, `>3` items are silently truncated rather than counted — worth a design sign-off but not a parity bug).

---

## OK — verified, no discrepancy

- **Row-level merge integrity:** 26 drinks in DEST = 24 `cocktails` + 1 `zero_cocktails` + 2 `zc_drinks` − 1 Upcykle dedup. No drop, no duplicate, confirmed by direct slug enumeration against SRC.
- **`DrinkTag` (style tags):** 63/63 `cocktail_tags` rows migrated exactly (bitter/blended/bourbon/brandy/fizzy/gin/hot/mezcal/premium/rum/sour/sweet/vodka all present, `test-tag` correctly excluded as junk). Per the brief's explicit question — **style tags (bitter/sour/sweet/fizzy/hot/premium/blended) are not surfaced in the old UI or the new one.** Old `FilterTags` row 1 only matched spirit-type keys; old `CocktailCard`/`BottomSheet` never rendered tags as chips at all (only flavors). New `content.py` never reads `Drink.tags`. This is **parity, not a regression** — flagging as OK per instructions, not as a new loss.
- **`DrinkFlavor`:** 87/87 `cocktail_flavors` rows migrated exactly; flavor labels correctly reach `descriptors` (uppercased, a deliberate kit-wide style choice — same treatment applied to classics/spirits descriptors elsewhere in the codebase, not a drinks-specific loss).
- **`drink_details` completeness:** 45 = 35 (`cocktail_details`) + 2 (`zero_cocktail_details`) + 6 (`zc_drink_details`) + 1 `glass_label_override` rescue (`upcyklecola`, the only non-blank override in prod) + 1 `ingredients_text` rescue (`gaslight_americano`). Every old detail row reaches the new `details` bundle field and is rendered by `c.details?.map(...)` in both mobile/desktop bodies (content-complete; see D5/D7 for rendering-quality caveats on the Upcykle merge and embedded newlines).
- **ABV parsing:** all 4 legacy encodings (`"13.3%"` dot-decimal+percent for cocktails, `"6,4 Alc"` comma-decimal+word for zc, `"Non Alc"` for zero) parse correctly into `abv`/`abv_raw`/`is_alcoholic`; spot-checked every one of the 26 rows against SRC, all numeric values match to the same precision (all source values have ≤1 decimal digit, `Numeric(5,2)` doesn't round anything).
- **Price:** `zero_cocktails.price = "430 ₽"` → `price_amount=430.00` correct; the zero/zc-specific fields (`caffeine_level`, `is_carbonated`) preserved exactly for `gaba` (caffeine 1, carbonated false) and correctly `NULL` for alcoholic-origin drinks.
- **`created_at`:** preserved verbatim from source for all three origins (spot-checked `dieter`: SRC and DEST timestamps identical to the microsecond).
- **`glass_id`/glass label:** correctly resolved for 25/26 drinks (only `gaba` has no glass in prod, correctly `NULL`); glass is not shown in either the old or new **detail sheet** for author drinks (old `BottomSheet.jsx` never rendered glass either — it was filter-only) — not a regression, just worth noting glass only surfaces via the filter row in both versions.
- **Dead schema columns (`recipe`, `garnish`, `pitch`, `about`, `naming`, `faq`, `photo`, `volume_ml`) are permanently `NULL`** for every migrated drink — expected, since prod's `cocktails`/`zero_cocktails`/`zc_drinks` never had structured equivalents (all authored prose lived in the generic `*_details` tables, which fully reach `details[]` — see above). Not a finding except where a specific rendering path assumes one of these is populated (`photo` → D2).
