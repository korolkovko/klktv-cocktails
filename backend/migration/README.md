# Migration: prod → v2 ETL

One-shot (re-runnable) pipeline that reads the live production database
(legacy schema: `cocktails` / `zero_cocktails` / `zc_drinks` / `classics` /
`spirit_entries` / `kitchen_dishes` / ... — string-typed free-text fields,
three separate drink tables) and populates the new v2 schema (`app/models.py`,
Alembic-managed: unified `drinks` table, typed numeric columns alongside
`*_raw` originals).

This is Phase 0 tooling. There is no admin UI yet, so this ETL is the only
way data gets into the v2 database — the team will run it again at cutover
to pick up any prod edits made between now and go-live.

## Modules

- `migration/source.py` — read-only fetch of every legacy table from prod
  (`SELECT * FROM <table>`, no writes; safe against a live production DB).
- `migration/parsers.py` — pure functions that turn legacy free-text
  (ABV, price, weight, timing, nutrition, spirit origin) into typed values.
- `migration/load.py` — transform + idempotent load into DEST.
- `migration/verify.py` — post-load counts + orphan + "needs attention" check.
- `migration/run.py` — CLI: runs `load` then `verify`.

## Configuration

Two environment variables, both required:

- `SRC_DATABASE_URL` — production database. **Read-only**: `source.py` only
  ever issues `SELECT`. Never write to this connection.
- `DEST_DATABASE_URL` — the new v2 database. This is the only database the
  ETL writes to.

Real credentials live in `backend/.env.migration`, which is **gitignored**
(matched by the repo's `.env.*` pattern) and is not checked in anywhere —
ask whoever set up the environment for a copy, or recreate it locally with
your own DB URLs in this form:

```bash
SRC_DATABASE_URL=postgresql://...   # prod, read-only
DEST_DATABASE_URL=postgresql://...  # v2 target, read-write
```

## How to run

From `backend/`:

```bash
set -a; source .env.migration; set +a
uv run python -m migration.run
```

This loads then verifies in one step and prints a `LOAD:` stats line
followed by the verify output. To only re-run verification against an
already-loaded DEST (skip re-reading/re-writing):

```bash
uv run python -m migration.run --verify-only
```

## Idempotency guarantee

The ETL is safe to run repeatedly against the same DEST — running it twice
in a row reproduces byte-identical stats and row counts. This matters
because it will be re-run at cutover, potentially after earlier dry runs.

- **Lookup/catalog tables** with a stable source id (`glasses`, `spirits`,
  `tags`, `flavors`, `descriptors`, `badges`, `families`, `categories`,
  `users`, `spirit_categories`, `kitchen_categories`, `timeline_entries`,
  `classics`, `spirit_entries`, `kitchen_dishes`) and composite-PK rows
  (`learning_progress`) are natural-key **upserts** via `Session.merge`:
  re-running with the same source data produces the same rows.
- **`drinks`** has no single stable source id (it merges three legacy
  tables), so it's upserted **by its unique `slug`**: look up the existing
  row, update columns in place if found, otherwise insert without setting
  `id` (DB-assigned). This is what makes re-running safe even though this
  code never chooses `drinks.id` itself.
- **Child rows with no natural key of their own** (`drink_details`,
  `drink_tags`, `drink_flavors`, `classic_spirits`, `classic_descriptors`,
  `classic_related_drinks`) are fully re-derived every run: existing rows
  for the parents being (re)loaded are deleted, then fresh rows are
  inserted. Safe because this ETL is the sole writer to DEST during Phase 0.

## What `verify.py` checks

Run automatically at the end of `migration.run` (unless `--verify-only`
without a prior load, in which case it checks whatever is already in DEST):

1. **Row counts**: `drinks` count equals
   `len(cocktails) + len(zero_cocktails) + len(zc_drinks) − 1` (the one
   Upcykle cross-subsystem duplicate — see below); `classics`,
   `spirit_entries`, `kitchen_dishes`, `learning_progress` counts each equal
   their source table's row count exactly (1:1 carry-over, no drops).
2. **No orphan progress**: every `learning_progress` row's `(kind, slug)`
   resolves to an existing `drinks` / `classics` / `kitchen_dishes` slug.
3. **NEEDS ATTENTION list**: flags any row where a `*_raw` free-text field
   contains a digit but its parsed/typed counterpart came out `None` —
   i.e. a parser likely missed a real value. An empty list means every raw
   field that looked like it held data was successfully parsed; a non-empty
   list is a signal to eyeball the source row and either accept it as
   genuinely unstructured text (raw is retained regardless — see next
   section) or fix the parser in `migration/parsers.py`.

## Verified final run (2026-07-19, branch `v2`)

Both a first run and an immediate second run against the same DEST produced
identical `LOAD:` stats and the identical verify output:

```
LOAD: {'upcykle_merges': 1, 'glass_overrides': 1, 'drinks': 26, 'classics': 67,
       'spirit_entries': 74, 'kitchen_dishes': 33, 'learning_progress': 189}
OK drinks=26 classics=67 spirits=74 dishes=33 progress=189
✓ all raw fields parsed cleanly
```

NEEDS ATTENTION: **0** rows on both runs — every `*_raw` field that looked
like it held a value parsed into a typed column.

Spot-checks against DEST (read-only queries):

| Check | Result | Expectation |
|---|---|---|
| `drinks` where `is_alcoholic=false` | 3 | ≥ 1 |
| `drinks` where `is_zero_culture=true` | 1 | ≥ 1 |
| `drinks.slug ilike '%upcykle%'` | exactly `upcyklecola` | exactly one row |
| `drink_details.label in ('Бокал','Ингредиенты')` | drink 21 → `Бокал`, drink 25 → `Ингредиенты` | both rescued rows present |
| `count(*) from drinks` | 26 | 26 |
| alcoholic drink with null slug | 0 | 0 |

## Notable transformations

- **Unified `drinks` table.** Prod has three parallel drink tables
  (`cocktails`, `zero_cocktails`, `zc_drinks`); v2 has one `drinks` table
  with `is_alcoholic` / `is_zero_culture` flags. One product ("Upcykle
  Cola") exists in both `zero_cocktails` and `zc_drinks` under the same
  normalized slug; the ETL dedups it, keeping the `zero_cocktails` version
  and merging the `zc_drinks` row's details into it (`upcykle_merges: 1`
  in the load stats).
- **Free-text → typed, raw preserved.** ABV, price, dish weight/timing, and
  nutrition were all free-text strings in prod (e.g. `"40%"`, `"350 р. за
  150мл"`). Each now has both a typed column (`abv`, `price_amount`,
  `weight_g`, `timing_min_low/high`, `kcal_*`/`protein_g`/`fat_g`/`carb_g`)
  and a `*_raw` column holding the original string untouched — nothing is
  discarded even when a value fails to parse.
- **No-data-loss rescues.** Two prod content columns have no dedicated v2
  column: `glass_label_override` (glass name override on
  cocktails/zero_cocktails/zc_drinks) and `zero_cocktails.ingredients_text`.
  Non-empty values are rescued as synthetic `drink_details` rows (labels
  `Бокал` and `Ингредиенты` respectively) instead of being silently
  dropped. `classics.glass_label_override` has no equivalent details table
  to rescue into; the load logs a loud count of any non-empty values there
  (prod currently has zero).
- **Test/junk filtering.** A small set of known test-data labels
  (`ДОБАВЛЕНО ИЗ UI`, `Тестовый`, `Обновлённый`, `test-tag`, `test_tag`) is
  excluded when loading `tags`, `flavors`, and `descriptors`, so leftover
  QA artifacts from prod don't leak into v2. Also excludes the legacy
  `zero`/`zc` rows from `categories` (superseded by the unified `drinks`
  flags).
- **`classic_progress` dropped.** This legacy table was a stale, strict
  subset of `learning_progress` (superseded, no longer written to in
  prod) and is not part of the v2 schema or this ETL's source table list;
  only `learning_progress` is migrated.
