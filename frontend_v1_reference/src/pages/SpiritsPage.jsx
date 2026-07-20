import { useMemo, useState } from 'react';
import { useContent } from '../data/ContentContext';
import FilterTags from '../components/FilterTags';
import SpiritCard from '../components/SpiritCard';
import SpiritSheet from '../components/SpiritSheet';

export default function SpiritsPage() {
  const { spiritCategories, spiritEntries } = useContent();
  const [selected, setSelected] = useState(null);
  const [archivedMode, setArchivedMode] = useState(false);
  const [activeCat, setActiveCat] = useState('all');

  const hasArchived = spiritCategories.some((c) => c.is_archived);

  // Categories visible in the current mode (current/archive)
  const visibleCats = useMemo(() =>
    [...spiritCategories]
      .filter((c) => archivedMode ? c.is_archived : !c.is_archived)
      .sort((a, b) => a.sort_order - b.sort_order),
    [spiritCategories, archivedMode]
  );

  const catFilters = useMemo(() => [
    { key: 'all', label: 'Все' },
    ...visibleCats.map((c) => ({ key: c.slug, label: c.label })),
  ], [visibleCats]);

  // Reset cat filter when switching modes (categories list changes)
  const switchMode = (mode) => {
    setArchivedMode(mode);
    setActiveCat('all');
  };

  // Group entries by category. When a specific category is active,
  // only that group is rendered.
  const grouped = useMemo(() => {
    const sourceCats = activeCat === 'all'
      ? visibleCats
      : visibleCats.filter((c) => c.slug === activeCat);
    return sourceCats.map((c) => ({
      cat: c,
      entries: spiritEntries
        .filter((e) => e.categorySlug === c.slug)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    })).filter((g) => g.entries.length > 0);
  }, [visibleCats, spiritEntries, activeCat]);

  return (
    <>
      {hasArchived && (
        <FilterTags
          filters={[
            { key: 'cur', label: 'В карте' },
            { key: 'arc', label: 'Выведенные' },
          ]}
          active={archivedMode ? 'arc' : 'cur'}
          onSelect={(k) => switchMode(k === 'arc')}
          className="nav-tags--classics-1"
        />
      )}

      <FilterTags
        filters={catFilters}
        active={activeCat}
        onSelect={setActiveCat}
        className={hasArchived ? 'nav-tags--classics-2' : 'nav-tags--classics-1'}
      />

      {grouped.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">:/</div>
          <div className="empty-state-text">В этой подкатегории пусто</div>
        </div>
      )}

      {grouped.map(({ cat, entries }) => (
        <section key={cat.slug} className="kitchen-section">
          {/* Hide the section header when only one category is shown — the
              filter tag at the top already says what the user picked.   */}
          {activeCat === 'all' && (
            <div className="section-header">
              <h2>{cat.label}{cat.is_archived ? ' · архив' : ''}</h2>
            </div>
          )}
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
