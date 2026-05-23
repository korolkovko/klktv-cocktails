import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../auth/api';

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    return api.get('/api/content')
      .then((data) => {
        // Backend uses snake_case (cocktail_spirit_filters, glass_tag, etc.).
        // Normalise to the shape the existing components consume.
        setBundle({
          categories: data.categories || [],
          cocktails: data.cocktails.map(normaliseCocktail),
          classics: data.classics.map(normaliseClassic),
          families: data.families,
          zeroCocktails: (data.zero_cocktails || []).map(normaliseZero),
          zcDrinks: (data.zc_drinks || []).map(normaliseZC),
          kitchenCategories: data.kitchen_categories || [],
          kitchenDishes: (data.kitchen_dishes || []).map(normaliseDish),
          spiritFilters: data.cocktail_spirit_filters,
          glassFilters: data.cocktail_glass_filters,
          timeline: data.timeline,
        });
      })
      .catch((e) => setError(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const value = useMemo(() => ({ ...bundle, loading, error, reload }), [bundle, loading, error]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used inside ContentProvider');
  return ctx;
}

// Map backend cocktail JSON → frontend shape the components already use.
function normaliseCocktail(c) {
  return {
    id: c.id,
    name: c.name,
    img: c.img,
    abv: c.abv,
    glass: c.glass,
    glassTag: c.glass_tag,
    tagline: c.tagline,
    tags: c.tags,
    flavors: c.flavors,
    details: c.details,
    badge: c.badge ? { type: c.badge.key, label: c.badge.label } : null,
  };
}

function normaliseDish(d) {
  return {
    id: d.id,
    categorySlug: d.category_slug,
    name: d.name,
    img: d.img,
    description: d.description,
    timing: d.timing,
    weight: d.weight,
    nutrition: d.nutrition,
    serving: d.serving,
  };
}

function normaliseZero(c) {
  return {
    id: c.id,
    name: c.name,
    img: c.img,
    price: c.price,
    abv: c.abv,
    glass: c.glass,
    glassTag: c.glass_tag,
    tagline: c.tagline,
    ingredients: c.ingredients,
    details: c.details,
  };
}

function normaliseZC(c) {
  return {
    id: c.id,
    name: c.name,
    img: c.img,
    isAlcoholic: c.is_alcoholic,
    price: c.price,
    abv: c.abv,
    glass: c.glass,
    glassTag: c.glass_tag,
    tagline: c.tagline,
    caffeineLevel: c.caffeine_level,
    isCarbonated: c.is_carbonated,
    details: c.details,
  };
}

function normaliseClassic(c) {
  return {
    id: c.id,
    name: c.name,
    family: c.family,
    year: c.year,
    origin: c.origin,
    spirits: c.spirits,
    composition: c.composition,
    glass: c.glass,
    glassTag: c.glass_tag,
    garnish: c.garnish,
    descriptors: c.descriptors,
    history: c.history,
    forWhom: c.for_whom,
    relatedOurs: c.related_ours,
  };
}
