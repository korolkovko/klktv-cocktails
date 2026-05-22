// Run from project root: node scripts/dump-data.mjs > backend/data/seed_data.json
// Imports the JS data files (single source of truth) and emits a flat JSON
// payload suitable for the backend seed migration.

import { cocktails, spiritFilters, glassFilters } from '../frontend/src/data/cocktails.js';
import { classics, classicFamilies, COCKTAIL_TIMELINE } from '../frontend/src/data/classics.js';

const payload = {
  cocktails,
  cocktailSpiritFilters: spiritFilters,
  cocktailGlassFilters: glassFilters,
  classics,
  classicFamilies,
  cocktailTimeline: COCKTAIL_TIMELINE,
};

process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
