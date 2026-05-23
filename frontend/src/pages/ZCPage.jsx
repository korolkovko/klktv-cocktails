import { useMemo, useState } from 'react';
import { useContent } from '../data/ContentContext';
import FilterTags from '../components/FilterTags';
import ZCCard from '../components/ZCCard';
import ZCSheet from '../components/ZCSheet';

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'alc', label: 'Алко' },
  { key: 'non', label: 'Non Alc' },
];

export default function ZCPage() {
  const { zcDrinks } = useContent();
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const list = useMemo(() => {
    if (filter === 'alc') return zcDrinks.filter((d) => d.isAlcoholic);
    if (filter === 'non') return zcDrinks.filter((d) => !d.isAlcoholic);
    return zcDrinks;
  }, [zcDrinks, filter]);

  return (
    <>
      <FilterTags filters={FILTERS} active={filter} onSelect={setFilter} />
      <section>
        <div className="section-header">
          <h2>Zero Culture</h2>
          <p className="section-sub">Тюнингованная подача, переосмысленная знакомая упаковка</p>
        </div>
        <div className="cocktail-list">
          {list.map((c) => (
            <ZCCard key={c.id} item={c} onClick={setSelected} />
          ))}
        </div>
        {list.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">:/</div>
            <div className="empty-state-text">Пока пусто.</div>
          </div>
        )}
      </section>
      <ZCSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
