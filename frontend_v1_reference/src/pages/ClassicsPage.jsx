import { useState, useMemo } from 'react';
import { useContent } from '../data/ContentContext';
import { useProgress } from '../data/useProgress';
import FilterTags from '../components/FilterTags';
import SearchBar from '../components/SearchBar';
import ClassicCard from '../components/ClassicCard';
import ClassicSheet from '../components/ClassicSheet';
import ProgressPanel from '../components/ProgressPanel';

const SPIRIT_FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'gin', label: 'Джин' },
  { key: 'vodka', label: 'Водка' },
  { key: 'rum', label: 'Ром' },
  { key: 'whiskey', label: 'Виски' },
  { key: 'brandy', label: 'Бренди' },
  { key: 'tequila', label: 'Текила' },
  { key: 'mezcal', label: 'Мескаль' },
  { key: 'other', label: 'Аперитив' },
];

export default function ClassicsPage({ onOpenAuthorCocktail }) {
  const { classics, families: classicFamilies } = useContent();
  const FAMILY_FILTERS = useMemo(() => [
    { key: 'all', label: 'Все' },
    ...classicFamilies.map((f) => ({ key: f.key, label: f.label })),
  ], [classicFamilies]);
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeSpirit, setActiveSpirit] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const { learned, toggle: toggleLearned } = useProgress('classics');

  const filtered = useMemo(() => {
    let list = classics;
    if (activeFamily !== 'all') list = list.filter((c) => c.family === activeFamily);
    if (activeSpirit !== 'all') list = list.filter((c) => c.spirits.includes(activeSpirit));
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.descriptors.some((d) => d.toLowerCase().includes(q)) ||
        (c.origin || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [classics, activeFamily, activeSpirit, search]);

  const activeFamilyObj = classicFamilies.find((f) => f.key === activeFamily);
  const pct = Math.round(learned.size / classics.length * 100);
  return (
    <>
      <FilterTags
        filters={FAMILY_FILTERS}
        active={activeFamily}
        onSelect={(k) => { setActiveFamily(k); setSearch(''); }}
        className="nav-tags--classics-1"
      />
      <FilterTags
        filters={SPIRIT_FILTERS}
        active={activeSpirit}
        onSelect={setActiveSpirit}
        className="nav-tags--classics-2"
      />

      <div className="classics-search-wrap">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Progress block */}
      <button className="classics-progress-btn" onClick={() => setShowProgress(true)}>
        <div className="classics-progress-top">
          <span className="classics-progress-text">Прогресс изучения</span>
          <span className="classics-progress-count">{learned.size} / {classics.length} · {pct}%</span>
        </div>
        <div className="classics-progress-track">
          <div className="classics-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </button>

      {/* Family theory block */}
      {activeFamilyObj && activeFamily !== 'all' && (
        <div className="classics-family-info" style={{ borderLeftColor: activeFamilyObj.color }}>
          <div className="classics-family-logic">{activeFamilyObj.logic}</div>
          {activeFamilyObj.evolution && (
            <div className="classics-family-evolution">{activeFamilyObj.evolution}</div>
          )}
          {activeFamilyObj.tip && (
            <div className="classics-family-tip">💡 {activeFamilyObj.tip}</div>
          )}
        </div>
      )}

      {/* Card grid */}
      <div className="cocktail-list classics-grid">
        {filtered.map((c) => (
          <ClassicCard
            key={c.id}
            classic={c}
            learned={learned.has(c.id)}
            onToggleLearned={toggleLearned}
            onClick={setSelected}
          />
        ))}
        {filtered.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="empty-state-icon">:/</div>
            <div className="empty-state-text">Нет коктейлей с таким фильтром</div>
          </div>
        )}
      </div>

      {selected && (
        <ClassicSheet
          classic={selected}
          learned={learned.has(selected.id)}
          onToggleLearned={toggleLearned}
          onClose={() => setSelected(null)}
          onOpenAuthorCocktail={(cocktail) => {
            setSelected(null);
            onOpenAuthorCocktail(cocktail);
          }}
        />
      )}

      {showProgress && (
        <ProgressPanel
          learned={learned}
          onClose={() => setShowProgress(false)}
          onOpenClassic={(c) => {
            setShowProgress(false);
            setSelected(c);
          }}
        />
      )}
    </>
  );
}
