import { useState, useMemo } from 'react';
import { classics, classicFamilies } from '../data/classics';
import FilterTags from '../components/FilterTags';
import ClassicCard from '../components/ClassicCard';
import ClassicSheet from '../components/ClassicSheet';

const FAMILY_FILTERS = [
  { key: 'all', label: 'Все' },
  ...classicFamilies.map((f) => ({ key: f.key, label: f.label })),
];

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
  const [activeFamily, setActiveFamily] = useState('all');
  const [activeSpirit, setActiveSpirit] = useState('all');
  const [selected, setSelected] = useState(null);
  const [learned, setLearned] = useState(() => {
    try {
      const saved = localStorage.getItem('classics_learned');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch {
      return new Set();
    }
  });

  const toggleLearned = (id) => {
    setLearned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('classics_learned', JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = useMemo(() => classics.filter((c) => {
    if (activeFamily !== 'all' && c.family !== activeFamily) return false;
    if (activeSpirit !== 'all' && !c.spirits.includes(activeSpirit)) return false;
    return true;
  }), [activeFamily, activeSpirit]);

  const activeFamilyObj = classicFamilies.find((f) => f.key === activeFamily);
  const progress = Math.round(learned.size / classics.length * 100);

  return (
    <>
      <FilterTags
        filters={FAMILY_FILTERS}
        active={activeFamily}
        onSelect={setActiveFamily}
        className="nav-tags--classics-1"
      />
      <FilterTags
        filters={SPIRIT_FILTERS}
        active={activeSpirit}
        onSelect={setActiveSpirit}
        className="nav-tags--classics-2"
      />

      <div className="classics-progress-wrap">
        <div className="classics-progress-bar" style={{ width: `${progress}%` }} />
        <span className="classics-progress-label">
          {learned.size} из {classics.length} выучено
        </span>
      </div>

      {activeFamily !== 'all' && activeFamilyObj && (
        <div className="classics-family-info" style={{ borderLeftColor: activeFamilyObj.color }}>
          <div className="classics-family-logic">{activeFamilyObj.logic}</div>
          {activeFamilyObj.evolution && (
            <div className="classics-family-evolution">{activeFamilyObj.evolution}</div>
          )}
        </div>
      )}

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
    </>
  );
}
