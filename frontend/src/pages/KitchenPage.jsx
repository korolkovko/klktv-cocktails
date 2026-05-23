import { useMemo, useState } from 'react';
import { useContent } from '../data/ContentContext';
import KitchenCard from '../components/KitchenCard';
import KitchenSheet from '../components/KitchenSheet';

export default function KitchenPage() {
  const { kitchenCategories, kitchenDishes } = useContent();
  const [selected, setSelected] = useState(null);

  // Group dishes by category, preserving category sort_order
  const grouped = useMemo(() => {
    const map = new Map();
    for (const c of [...kitchenCategories].sort((a, b) => a.sort_order - b.sort_order)) {
      map.set(c.slug, { label: c.label, dishes: [] });
    }
    for (const d of kitchenDishes) {
      const cat = map.get(d.categorySlug);
      if (cat) cat.dishes.push(d);
    }
    return [...map.entries()].filter(([, v]) => v.dishes.length > 0);
  }, [kitchenCategories, kitchenDishes]);

  return (
    <>
      {grouped.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">:/</div>
          <div className="empty-state-text">Меню кухни пока пустое.</div>
        </div>
      )}
      {grouped.map(([slug, { label, dishes }]) => (
        <section key={slug} className="kitchen-section">
          <div className="section-header">
            <h2>{label}</h2>
          </div>
          <div className="cocktail-list">
            {dishes.map((d) => (
              <KitchenCard key={d.id} dish={d} onClick={setSelected} />
            ))}
          </div>
        </section>
      ))}
      <KitchenSheet dish={selected} onClose={() => setSelected(null)} />
    </>
  );
}
