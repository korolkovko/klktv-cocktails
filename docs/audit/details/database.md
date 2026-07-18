# Production DB Audit — klktv Cocktails / Bar Menu App

**Database:** Postgres 15, Railway (`kodama.proxy.rlwy.net:42310` / `railway`)
**Audit date:** 2026-07-19
**Access:** strictly read-only (SELECT / `\d` / catalog reads only — no writes performed)
**Scale:** 28 tables, ~1,150 rows total. This is a **small, staff-facing content DB** (a bar's cocktail/food/spirits "menu + learning" app), not a high-traffic OLTP system. That materially affects the verdict: performance concerns are near-irrelevant; **content modeling and data cleanliness are what matter**.

---

## 1. Schema dump & relational model

### 1.1 Reference / lookup tables (small dictionaries)

| Table | Columns (type, null) | Keys / constraints |
|---|---|---|
| **users** | id PK; username varchar(64) NOT NULL; password_hash text NOT NULL; role varchar(16) NOT NULL; name varchar(128) NULL; created_at tz NOT NULL default now() | PK(id); UNIQUE(username) |
| **families** | id PK; key varchar(32) NN; label varchar(64) NN; sub varchar(128); color varchar(16); logic text; evolution text; tip text; sort_order int NN | PK(id); UNIQUE(key) |
| **glasses** | id PK; key varchar(32) NN; label varchar(64) NN; sort_order int NN | PK(id); UNIQUE(key) |
| **spirits** | id PK; key varchar(32) NN; label varchar(64) NN; sort_order int NN | PK(id); UNIQUE(key) |
| **badges** | id PK; key varchar(32) NN; label varchar(64) NN | PK(id); UNIQUE(key) |
| **categories** | id PK; key varchar(32) NN; label varchar(64) NN; kind varchar(32) NN; sort_order int NN; is_visible bool NN | PK(id); UNIQUE(key) |
| **tags** | id PK; key varchar(32) NN | PK(id); UNIQUE(key) — **no label column** (inconsistent with other lookups) |
| **flavors** | id PK; label varchar(128) NN | PK(id); UNIQUE(label) |
| **descriptors** | id PK; label varchar(128) NN | PK(id); UNIQUE(label) |
| **timeline_entries** | id PK; period varchar(64) NN; description text NN; examples text; sort_order int NN | PK(id) only |

### 1.2 Cocktails domain

- **cocktails**: id PK; slug varchar(64) NN UNIQUE; name varchar(128) NN; img varchar(256); abv varchar(16); tagline text; glass_id→glasses (SET NULL); glass_label_override varchar(64); badge_id→badges (SET NULL); sort_order NN; created_at/updated_at tz NN.
- **cocktail_details**: id PK; cocktail_id→cocktails (CASCADE); label varchar(128) NN; text text NN; sort_order NN. Index on cocktail_id. (Generic label/text "content blocks".)
- **cocktail_flavors** (M:N): (cocktail_id, flavor_id) PK; sort_order NN.
- **cocktail_tags** (M:N): (cocktail_id, tag_id) PK; sort_order NN.

### 1.3 Classics ("learning" domain)

- **classics**: id PK; slug UNIQUE; name NN; family_id→families (**RESTRICT**) NN; year int; origin varchar(128); composition text; glass_id→glasses (SET NULL); glass_label_override varchar(64); garnish text; history text; for_whom text; sort_order NN; timestamps. Index on family_id + slug.
- **classic_spirits** (M:N): (classic_id, spirit_id) PK.
- **classic_descriptors** (M:N): (classic_id, descriptor_id) PK.
- **classic_related_cocktails** (M:N classics→cocktails): (classic_id, cocktail_id) PK.

### 1.4 Spirits catalog

- **spirit_categories**: id PK; slug UNIQUE; label NN; sort_order NN; is_archived bool NN.
- **spirit_entries**: id PK; slug UNIQUE; category_id→spirit_categories (**RESTRICT**) NN; name varchar(256) NN; img; abv varchar(32); price varchar(64); flavour text; **brand_country text**; features text; cocktail_pairings text; fact text; **brand text**; **country text**; source_url text; sort_order; timestamps. (Note the three overlapping origin fields — see §3/§4.)

### 1.5 Kitchen (food menu)

- **kitchen_categories**: id PK; slug UNIQUE; label NN; sort_order NN.
- **kitchen_dishes**: id PK; slug varchar(80) UNIQUE; category_id→kitchen_categories (**RESTRICT**) NN; name varchar(256) NN; img; description text; **timing varchar(32)**; **weight varchar(64)**; **nutrition text**; **serving text**; interesting_facts text; **price varchar(32)**; tagline text; sort_order; timestamps.

### 1.6 Non-alcoholic — TWO PARALLEL IMPLEMENTATIONS

- **zero_cocktails** (older): id PK; slug UNIQUE; name NN; img; price varchar(32); abv varchar(32); glass_id→glasses; glass_label_override; tagline; ingredients_text text; sort_order; timestamps.
  - **zero_cocktail_details**: id PK; parent_id→zero_cocktails (CASCADE); label NN; text NN; sort_order.
- **zc_drinks** (newer, superset): id PK; slug UNIQUE; name NN; img; **is_alcoholic bool NN**; price varchar(32); abv varchar(32); glass_id→glasses; glass_label_override; tagline; **caffeine_level int**; **is_carbonated bool (NULLABLE, no default)**; sort_order; timestamps.
  - **zc_drink_details**: id PK; parent_id→zc_drinks (CASCADE); label NN; text NN; sort_order.

### 1.7 Progress — TWO PARALLEL IMPLEMENTATIONS

- **classic_progress** (older, classic-specific): (user_id→users, classic_id→classics) PK; learned_at tz NN default now().
- **learning_progress** (newer, generic): (user_id→users, kind varchar(32), slug varchar(80)) PK; learned_at tz NN. **`slug` is a soft/text reference — no FK.**

### Relational-model summary
The design is a clean, textbook star/dictionary model: a handful of **lookup dictionaries** (glasses, spirits, tags, flavors, descriptors, badges, families, categories) feed **five content domains** (cocktails, classics, spirits, kitchen, non-alcoholic), each with a parent + M:N link tables + a generic "detail blocks" child table. Referential integrity is **properly enforced with FKs everywhere** (CASCADE on child/link rows, SET NULL on optional lookups, RESTRICT on mandatory parents). The relational skeleton is genuinely good. The problems are (a) **two duplicated subsystems** (non-alcoholic ×2, progress ×2), and (b) **structured values stored as free text**.

---

## 2. Row counts (all 28 tables)

| Table | Rows | | Table | Rows |
|---|--:|---|---|--:|
| classic_descriptors | 217 | | glasses | 12 |
| learning_progress | 189 | | users | 12 |
| cocktail_flavors | 87 | | spirit_categories | 10 |
| spirit_entries | 74 | | families | 9 |
| classics | 67 | | spirits | 9 |
| classic_spirits | 67 | | timeline_entries | 8 |
| classic_descriptors… | | | kitchen_categories | 7 |
| cocktail_tags | 63 | | categories | 6 |
| descriptors | 80 | | zc_drink_details | 6 |
| flavors | 59 | | badges | 4 |
| cocktail_details | 35 | | classic_progress | 3 |
| kitchen_dishes | 33 | | zc_drinks | 2 |
| cocktails | 24 | | zero_cocktail_details | 2 |
| classic_related_cocktails | 17 | | zero_cocktails | 1 |
| tags | 14 | | | |

Everything is tiny. The largest table (classic_descriptors) is 217 rows.

---

## 3. Data-quality problems (with real sampled values)

### 3.1 🔴 ABV stored 4 different ways in 4 tables (free text, incompatible)

| Table | Column | Example values | Convention |
|---|---|---|---|
| cocktails | abv varchar(16) | `10.5%`, `12.0%`, `23.1%` | number **+ `%`**, dot decimal |
| spirit_entries | abv varchar(32) | `40`, `41.3`, `9.5` | **bare** number, dot decimal (29 rows are exactly `40`) |
| zc_drinks | abv varchar(32) | `6,4 Alc` | **comma** decimal + word `Alc` |
| zero_cocktails | abv varchar(32) | `Non Alc` | **pure text word** |

Four tables, four mutually-incompatible encodings of the same concept. None is a numeric type.

### 3.2 🔴 Price stored as free text with inconsistent currency/units

**kitchen_dishes.price** (`NNN₽`, no space) — distinct values:
`30₽, 50₽, 250₽, 300₽, 320₽, 330₽, 350₽, 380₽, 390₽, 400₽ (×7), 430₽, 450₽, 480₽, 490₽` + **4 NULL**. (Fairly consistent within this table, but note `30₽`/`50₽` are add-on prices mixed with dish prices.)

**zero_cocktails.price** = `430 ₽` — **space before ₽** (opposite of kitchen's `430₽`). Two tables, two currency-formatting conventions.

**spirit_entries.price** varchar(64) — **badly unstructured**, 18/74 non-numeric, mixing amount + serving-size + currency + **embedded newlines**:
```
400            400 за 30       400 за\n30мл      450\nза 30
550 за 30мл    500р\nза 100мл  550р за 100мл     650\nза\n30мл
600р\nза 100мл 800р\nза 100мл  700 за 30
```
Same field encodes: bare rubles, "per 30ml", "per 100ml", with/without `р`, with literal `\n` line breaks. Not machine-parseable without heuristics; serving basis (30ml vs 100ml) is inconsistent and would misrepresent price if compared directly.

### 3.3 🔴 Nutrition (КБЖУ) free text — at least two incompatible formats

**kitchen_dishes.nutrition** (33 rows). Dominant format (ids 1–21, 24–37):
```
На порцию: 329г · 503 ккал · Б 29,0 · Ж 6,8 · У 75,7
На 100г: 153 ккал
```
Minority format (ids **22, 23, 26, 27**) — lowercase letters, no bullets, kcal moved to the end, `гр` vs `г`, double spaces:
```
На порцию б 0,16 ж 18,62 у 5,96 195,2  ккал
На 100гр б 0,4  ж 46,55  у 14,92 488,01 ккал
```
So КБЖУ (protein/fat/carbs/kcal), portion grams, and per-100g are all buried in prose with ≥2 layouts. **`weight` column is redundant** — it just repeats the "На порцию: Xг" number already inside `nutrition` (all `weight` values are bare integers 30–428, no units, **no `/` composites** like the feared `280/50` in this DB).

### 3.4 🟠 timing free text, inconsistent granularity

**kitchen_dishes.timing** varchar(32): `1, 2, 3, 5, 8, 10, 12` (bare minutes) mixed with ranges `10-12` and **13 blank (39%)**. No unit stored.

### 3.5 🔴 spirit_entries: THREE overlapping origin fields, migration half-done

Columns `brand`, `country`, and legacy `brand_country` all describe origin, plus `source_url`:

| Field | Blank | Notes |
|---|--:|---|
| brand | 49/74 (66%) | often multi-valued: `Destileria Orendain; Orendain Batanga`, `Bodega San Isidro; BarSol` |
| country | 22/74 (30%) | **13 rows literally contain `регион:` prefix garbage** (`регион:Испания`, `регион: Тринидад и Тобаго`, `регион:`); id 46 country field holds brand+producer: `Италия. Бренд: Fiorente. Производитель:Fratelli Francoli` |
| **brand_country** (legacy) | 1/74 | The field that's actually populated — but **26/74 (35%) contain a full multi-paragraph company history**, not "brand/country" (e.g. id 27, 29, 30, 34 are 300–900-char essays). Semantically overloaded. |
| source_url | **72/74 (97%) blank** | yet URLs are embedded inside `brand_country` text (ids 14/16/17: `https://www.dewars.com/`, `fourrosesbourbon.com`, …) — the dedicated column is dead while its data lives in prose |

This is a classic **incomplete refactor**: someone added structured `brand`/`country`/`source_url` columns intending to migrate off `brand_country`, but the migration was never finished — the legacy free-text field still holds the real data (region info, company histories, and URLs all jammed together).

### 3.6 🟠 Typos, stray characters, test artifacts in production

- **`Ирдандия`** (misspelled "Ирландия"/Ireland) in **3 rows** (spirit_entries 19/20/21, the Waterford whiskeys).
- **`Габа.`** — trailing period in zc_drinks name (id 1).
- **`Upcykle™ Cola`** — `™` trademark char in names (fine as UTF-8, but worth normalizing).
- **Test/debug artifacts left in prod reference tables:**
  - tag `test-tag`
  - flavor **`ДОБАВЛЕНО ИЗ UI`** ("ADDED FROM UI") — clearly a debug artifact from the editing UI
  - descriptors `Тестовый` ("Test"), `Обновлённый` ("Updated")
- Encoding: **no mojibake / replacement characters found** — data is clean UTF-8. Content is Russian throughout (expected); only stray Latin is inside origin fields.

### 3.7 🟠 Same product duplicated across two menu systems

`Upcykle™ Cola` exists as **cocktails id 22** (slug `upcyklecola`) **and** **zc_drinks id 2** (slug `upcykle_cola`) — two rows, two different slug conventions (no-separator vs underscore), and its detail blocks (`Что такое Upcykle™?`, `На обратной этикетке`) are duplicated in both `cocktail_details` and `zc_drink_details`. Note zc_drinks id 2 is also flagged **`is_alcoholic = TRUE`** despite living in the "zero/zc" (non-alcoholic-oriented) subsystem.

### 3.8 Nulls where data is expected (blank-field rates)

- kitchen_dishes (33): price 4 null, timing **13 blank (39%)**, interesting_facts **25 blank (76%)**, tagline 8, img 7, serving 7. (nutrition 0 blank, weight 0 blank — good.)
- cocktails (24): abv 1 blank, img 0, tagline 0, glass 0 — **well populated**.
- spirit_entries (74): abv 0 blank, price 0 blank — core fields complete.
- `serving` (kitchen) is descriptive prose with repeated typos across near-duplicate rows: `деревяной` (×2), `салфекой`, `пергамете`, `алюм.`.

### 3.9 Unreferenced dictionary entries (minor)

Defined-but-never-used lookup rows: descriptors 3 of 80 (incl. `Тестовый`), flavors 1 of 59 (`ДОБАВЛЕНО ИЗ UI`), tags 1 of 14 (`test-tag`), spirits 1 of 9 (`Бурбон`). Glasses/badges fully used. These are dictionary cruft, not orphans (FKs prevent true orphans).

### 3.10 No true orphans, no duplicate slugs/names

- FK constraints are enforced everywhere → **zero dangling FK rows**.
- All `slug`/`key`/`label` uniqueness constraints hold; **no duplicate names** within cocktails/kitchen/spirits.
- `learning_progress.slug` is a soft reference (no FK) but **currently 100% valid**: 162 `classics` → classics.slug, 21 `kitchen` → kitchen_dishes.slug, 6 `menu` → cocktails.slug. No orphans today — but nothing prevents future orphans (see §5).

---

## 4. Schema smells

### 4.1 🔴 `glass_label_override` — added to 4 tables, used exactly ONCE
Every drink table carries both `glass_id` (FK) **and** a free-text `glass_label_override`. Actual usage:

| Table | Rows | non-blank override |
|---|--:|--:|
| cocktails | 24 | **0** |
| classics | 67 | **0** |
| zero_cocktails | 1 | **0** |
| zc_drinks | 2 | **1** (`Coca Cola glass bottle 250ml`, and that row's glass_id is NULL) |

**1 use across 94 rows (1%).** The one use is a fallback where the FK dictionary had no matching glass. A single "custom glass" edge case does not justify a parallel free-text override column on four tables — it should be a single nullable text field or handled by adding the glass to the dictionary.

### 4.2 🔴 Two parallel non-alcoholic subsystems
`zero_cocktails`/`zero_cocktail_details` (1 + 2 rows) **and** `zc_drinks`/`zc_drink_details` (2 + 6 rows) model the same thing. Both are near-empty; both are exposed (categories has separate `zero` = "Non Alco" and `zc` = "Zero Culture" sections). `zc_drinks` is the **newer superset** (adds `is_alcoholic`, `caffeine_level`, `is_carbonated`). The same product (`Upcykle Cola`) sits in both. This is duplicated modeling of one concept.

### 4.3 🔴 Two parallel progress tables — legacy is a frozen subset
- `classic_progress`: **3 rows, 1 user** (user 1: whiskey_sour, daiquiri, vodka_martini).
- `learning_progress`: **189 rows, 7 users**, generic `(kind, slug)` — kinds `classics` (162), `kitchen` (21), `menu` (6).
- **Sync check:** all 3 `classic_progress` rows are present in `learning_progress` under `kind='classics'` → `classic_progress` is a **strict, stale subset** fully superseded by `learning_progress`. It is dead legacy: writes clearly go to `learning_progress` now (7 users vs 1).

### 4.4 🟠 Always-constant / weak boolean columns
- `categories.is_visible` = **`true` for all 6 rows** → dead flag (no category ever hidden).
- `zc_drinks.is_carbonated` = **nullable boolean with no default**, actual values `{false, NULL}` → 3-valued where 2 intended; should be NOT NULL DEFAULT false.
- (`spirit_categories.is_archived` is fine — 1 of 10 archived, used meaningfully.)

### 4.5 🟠 Structured values typed as `varchar` instead of proper types
ABV (all 4 tables), price (4 tables), weight, timing, `year` is the only origin/number field actually typed as int. Everything money/percent/mass/time is text. `caffeine_level` is a bare int with no scale documented.

### 4.6 🟡 Inconsistent lookup design
`tags` has **only `key`** (no `label`) while every other dictionary (`spirits`, `glasses`, `families`, `badges`, `categories`) has `key` + `label`. Tag keys double as display text (`bitter`, `gin`…).

### 4.7 🟡 Generic "detail blocks" tables with free-text labels
`cocktail_details` / `zc_drink_details` / `zero_cocktail_details` are near-EAV: `(label, text)` where label is free prose (`Про название` ×19, `О коктейле` ×10, `Отсылки`, `Про сам коктейль`, `Вкус`, `Что такое Upcykle™?`). Flexible but unnormalized — the same semantic block is labeled inconsistently (`О коктейле` vs `Про сам коктейль`). Three near-identical detail tables could be one.

### 4.8 🟡 FK columns without a supporting index (11)
`cocktails.badge_id`, `cocktails.glass_id`, `classics.glass_id`, `cocktail_tags.tag_id`, `cocktail_flavors.flavor_id`, `classic_spirits.spirit_id`, `classic_descriptors.descriptor_id`, `classic_related_cocktails.cocktail_id`, `classic_progress.classic_id`, `zero_cocktails.glass_id`, `zc_drinks.glass_id`. **Performance-irrelevant at this scale** (≤217 rows), but a completeness gap and reverse-lookup/DELETE-scan smell to fix in the redesign.

### 4.9 Sequence/id gaps (cosmetic)
`timeline_entries` ids start at 9 (1–8 deleted); other tables have small gaps (deleted-then-recreated content). Harmless, but indicates hand-editing history.

---

## 5. Migration risk notes (prod → new DB)

1. **Free-text → typed columns is the core migration work, not the schema move.** Preserving all data is trivial (dump/restore). The value is in **parsing** during ETL:
   - ABV: strip `%`/`Alc`, normalize `,`→`.`, map `Non Alc`→0/null-with-flag. Four different source encodings must each be handled.
   - price: split amount / currency / serving-basis; **strip embedded `\n`**; reconcile `430₽` vs `430 ₽`; decide how to represent "per 30ml" vs "per 100ml" spirit pours (a `price_amount` + `price_per_volume_ml` pair).
   - nutrition: regex-parse КБЖУ from **two layouts** into `portion_g, kcal, protein, fat, carbs, kcal_per_100g`. The 4 minority-format rows (22,23,26,27) will need special handling or manual fixup.
   - **Recommendation: parse into a staging table, keep the original string in a `*_raw` column, and hand-verify the ~10 non-conforming rows.** Data volume is tiny (33 dishes, 74 spirits) so manual QA of edge cases is entirely feasible — arguably cheaper than perfect regexes.

2. **`spirit_entries` origin fields need a human decision.** `brand`/`country` (new, half-filled) vs `brand_country` (legacy, full, but polluted with histories + URLs). Migration must: split `brand_country` into brand/country/description, extract embedded URLs into `source_url`, strip `регион:` prefixes from `country`, fix `Ирдандия`. This is the single messiest table to migrate.

3. **Decide the fate of duplicated subsystems before migrating** (not after):
   - Non-alcoholic: collapse `zero_cocktails` into `zc_drinks` (superset) — but that means merging the `Upcykle Cola` duplicate and reconciling its detail blocks. The app currently shows both as separate menu sections (`zero` + `zc` categories), so this is a **product decision**, not purely technical.
   - Progress: drop `classic_progress` (stale subset); migrate only `learning_progress`. Zero data loss since it's a strict subset.

4. **`learning_progress.slug` has no FK.** If the redesign changes slugs or reorganizes content, these soft references silently break. In the new schema, back progress with real FKs to a unified content table, or at minimum a `(content_type, content_id)` pair.

5. **Test/debug rows should be scrubbed, not migrated:** `test-tag`, `ДОБАВЛЕНО ИЗ UI`, `Тестовый`, `Обновлённый`, and possibly `Габа.`'s trailing period.

6. **Preserve-all-data IS compatible with a schema redesign.** Because integrity is clean (no orphans, unique keys hold) and volume is tiny, a redesign that re-types columns and merges the duplicate subsystems loses **no** information as long as original free-text is retained during ETL. There is no conflict between "keep everything" and "redesign the schema."

---

## 6. Verdict: **EVOLVE** (lean toward selective REDESIGN of the messy corners)

**Not KEEP, not full REDESIGN — EVOLVE.**

**Why not KEEP:** the free-text ABV/price/nutrition/weight/timing fields, the `brand`/`country`/`brand_country` triple, the two duplicated subsystems, the 1%-used override columns, and the dead flags are real debt that a fresh DB is the ideal moment to fix.

**Why not full REDESIGN:** the **relational bones are genuinely good** — normalized dictionaries, proper M:N link tables, FK integrity enforced everywhere with sensible ON DELETE semantics, unique slugs/keys, consistent audit columns (created_at/updated_at). There is nothing structurally broken to throw away, and integrity is clean. Rebuilding from scratch would discard sound work and risk regressions.

**Recommended EVOLVE moves (high → low priority):**
1. Re-type the free-text structured fields: `abv NUMERIC`, price → `price_amount NUMERIC` + `currency` + optional `serving_ml`; nutrition → explicit KБЖУ columns; `weight_g INT`; `prep_minutes` (min/max). Keep `*_raw` text during migration.
2. **Collapse the two non-alcoholic subsystems** into one (`zc_drinks` superset) and the three `*_details` tables into one polymorphic detail table (or per-domain, but consistently).
3. **Drop `classic_progress`**; keep `learning_progress`, and give its `slug` reference real integrity.
4. Split/clean `spirit_entries` origin: proper `brand`, `country`, `region`, `description`, `source_url`; retire `brand_country`.
5. Replace the 4× `glass_label_override` columns with a single fallback pattern (or extend the glasses dictionary).
6. Drop dead `categories.is_visible` (or actually use it); make `is_carbonated` NOT NULL DEFAULT false.
7. Give `tags` a `label`; add indexes on FK columns in the new schema; scrub test/debug rows and the `Ирдандия`/`Габа.` typos.

The current DB is a **well-structured skeleton wrapped around undisciplined free-text content**. Migrate the skeleton, re-type and de-duplicate the flesh.
