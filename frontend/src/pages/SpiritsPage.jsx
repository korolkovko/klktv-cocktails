import { useMemo, useState } from 'react';
import { useContent } from '../data/ContentContext';
import FilterTags from '../components/FilterTags';
import SpiritCard from '../components/SpiritCard';
import SpiritSheet from '../components/SpiritSheet';

export default function SpiritsPage() {
  const { spiritCategories, spiritEntries } = useContent();
  const [selected, setSelected] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const grouped = useMemo(() => {
    const visible = [...spiritCategories]
      .filter((c) => showArchived || !c.is_archived)
      .sort((a, b) => a.sort_order - b.sort_order);
    return visible.map((c) => ({
      cat: c,
      entries: spiritEntries
        .filter((e) => e.categorySlug === c.slug)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    })).filter((g) => g.entries.length > 0);
  }, [spiritCategories, spiritEntries, showArchived]);

  const hasArchived = spiritCategories.some((c) => c.is_archived);

  return (
    <>
      {hasArchived && (
        <FilterTags
          filters={[
            { key: 'cur', label: 'В карте' },
            { key: 'arc', label: 'Выведенные' },
          ]}
          active={showArchived ? 'arc' : 'cur'}
          onSelect={(k) => setShowArchived(k === 'arc')}
        />
      )}

      {grouped.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">:/</div>
          <div className="empty-state-text">Пока пусто.</div>
        </div>
      )}

      {grouped.map(({ cat, entries }) => (
        <section key={cat.slug} className="kitchen-section">
          <div className="section-header">
            <h2>{cat.label}{cat.is_archived ? ' · архив' : ''}</h2>
          </div>
          <div className="cocktail-list">
            {entries.map((e) => (
              <SpiritCard key={e.id} entry={e} onClick={setSelected} />
            ))}
          </div>
        </section>
      ))}

      <SpiritSheet entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
