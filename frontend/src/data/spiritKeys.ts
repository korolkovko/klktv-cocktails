// Bidirectional map between a spirit's DB slug (used by
// GET/POST/DELETE /api/me/progress/spirits/{slug}) and the kit's internal
// spirit "learned key" — the composite string `${categoryLabel}:${name}`
// that `data.ts`'s `sectionLearnedLive`/`SpiritsView`/`page.tsx` use to
// identify a spirit in the learned-Set (see blueprint §C). Built once per
// loaded bundle; Task 4 wires the result into progress load/toggle.

import type { ContentBundle } from "./bundle"

export interface SpiritKeyMaps {
  slugToKey: Map<string, string>
  keyToSlug: Map<string, string>
}

export function buildSpiritKeyMaps(bundle: ContentBundle): SpiritKeyMaps {
  const labelBySlug = new Map(bundle.spiritCategories.map((c) => [c.slug, c.label]))
  const slugToKey = new Map<string, string>()
  const keyToSlug = new Map<string, string>()
  for (const s of bundle.spirits) {
    const key = `${labelBySlug.get(s.categorySlug) ?? s.categorySlug}:${s.name}`
    slugToKey.set(s.slug, key)
    keyToSlug.set(key, s.slug)
  }
  return { slugToKey, keyToSlug }
}
