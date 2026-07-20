# Data-parity audit — old prod ↔ v2 — SUMMARY & resolution

**Date:** 2026-07-20. **Method:** 5 parallel auditors, one per content domain, each
tracing every old field: prod DB + what the old frontend (`main` branch) rendered
→ new DB → `content.py` serializer → `/api/content` bundle → `mapBundle` → kit UI.
Per-domain detail: `drinks.md`, `spirits.md`, `kitchen.md`, `classics-families.md`,
`lookups-progress-users-timeline.md`.

**Row-integrity: clean.** Every domain confirmed zero row loss / zero orphans —
drinks 26 (24 cocktails + 1 zero + 2 zc − 1 Upcykle dedup), classics 67, spirits 74,
kitchen 33, learning_progress 189 (+1 dev row), families 9, all lookups. The junk
filter dropped only genuine test rows. **All losses found were in
serialization/rendering, not in the migration copy.**

## HIGH findings — ALL FIXED

| # | Domain | Loss | Fix |
|---|--------|------|-----|
| 1 | drinks | `DrinkSpirit` never populated → every drink's base spirit + the Авторские spirit filter gone (`filters.spirits=[]`) | ETL `load.py` step 7b: populate `DrinkSpirit` from spirit-type `cocktail_tags` (gin/rum/…). Re-run. Now 24 drink_spirits, filter = Джин·Водка·Бренди·Бурбон·Ром·Мескаль |
| 2 | drinks | Merged menu order scrambled (3 source tables all numbered `sort_order` from 0) | ETL: offset zero (+1000) / zc (+2000) so cocktails stay first in curated order |
| 3 | drinks | Alcoholic drink with unrecorded ABV shows false **"0% ABV"** (Undressed Negroni) | `abv ?? undefined` (not `?? 0`); `Meta`/card omit the ABV chip when alcoholic & abv absent |
| 4 | spirits | Spirit **price** parsed into DB but never serialized → dropped from UI (old cards showed it) | serialize `price`+`serving`; shown in spirit detail meta + list row |
| 5 | kitchen | Dish order within a category nondeterministic (all `sort_order=0`, `id` tiebreak dropped) | `models.py` `order_by="KitchenDish.sort_order, KitchenDish.id"` |
| 6 | kitchen | Per-100g kcal (`kcal_100g`) stored but never serialized (old sheet showed it) | serialize `kcal100`; rendered under the КБЖУ grid |
| 7 | kitchen | Dishes w/o price/timing render "0 ₽" / "0 МИН" (4/33 price, 13/33 timing) | `price/weight/timing ?? undefined`; card + detail meta built conditionally |
| 8 | classics | Search matched only `name`; old also matched `descriptors[]` + `origin` | ClassicsView search predicate now matches name + city + descriptors |

**Not a loss (verified):** the drinks "hero photo never renders" finding — prod
cocktails never had a separate hero photo column, only the logo; the kit's `photo`
field is reserved for admin-added photos (Phase 2). Verified it renders correctly
when present (see photo-resilience note below).

## MED findings

FIXED: descriptor dedup (spirit label no longer doubles a same-named flavor chip);
spirit list row restored thumbnail + flavour tagline + price; family filter pills use
the curated `title` (`Negroni & Friends`) not `cap(code)`; classic year/city guards
(no dangling "· ·"); detail prose `whitespace-pre-line` (embedded newlines preserved).

DEFERRED (documented, not silent):
- `families.color` — migrated byte-identical but unused; new UI uses the per-tint
  marker system instead of the old border/bar color. Cosmetic redesign, no data lost.
- Badge label detail "Bottle 250ml" → serialized as bare `BOTTLE` (the "250ml" fact
  dropped). Niche (bottled cocktails); revisit if it matters.
- Kitchen card subtitle doesn't fall back to `description` when `tagline` is blank
  (8/33 dishes have an empty card subtitle; the text still shows in the detail sheet).
- Upcykle Cola dedup leaves overlapping (not lost) prose in `details`.

## LOW / not-a-regression (documented)
`*_raw` columns (abv/price/weight/timing/nutrition) migrated but intentionally
unused (parsed values are canonical); `families.sub` unused (also unused in old UI);
`ClassicOut.spirit` serializes only the first spirit (prod has exactly 1 each);
`timeline_entries` migrated but unrendered (was also dead in the old UI — History
section deferred); curated glass-filter pill order not preserved; category
`sort_order` not in bundle (order still correct via query).

## Photo resilience (owner asked)
Grid cards never render a spirit `img` / cocktail `photo` — those appear only in the
detail sheet (`BottlePhoto` object-contain, `Photo` object-cover — both conditional
and fit-safe) and now also the spirit list thumbnail (object-contain on white). Live
smoke test: injected a real image into one spirit + one cocktail → flowed through the
bundle, `resolveImageUrl` passed the absolute URL, image loaded 200, layout intact.
Adding bottle/cocktail photos in Phase 2 will not break either view.
