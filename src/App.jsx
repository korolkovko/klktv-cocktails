import { useState, useMemo } from 'react';
import { cocktails, spiritFilters, glassFilters } from './data/cocktails';
import SearchBar from './components/SearchBar';
import FilterTags from './components/FilterTags';
import CocktailCard from './components/CocktailCard';
import BottomSheet from './components/BottomSheet';

export default function App() {
  const [search, setSearch] = useState('');
  const [activeSpirit, setActiveSpirit] = useState('all');
  const [activeGlass, setActiveGlass] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = cocktails;

    if (activeSpirit !== 'all') {
      list = list.filter((c) => c.tags.includes(activeSpirit));
    }

    if (activeGlass !== 'all') {
      list = list.filter((c) => c.glassTag === activeGlass);
    }

    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.flavors.some((f) => f.toLowerCase().includes(q))
      );
    }

    return list;
  }, [search, activeSpirit, activeGlass]);

  return (
    <div className="container">
      <SearchBar value={search} onChange={setSearch} />
      <FilterTags filters={spiritFilters} active={activeSpirit} onSelect={setActiveSpirit} />
      <FilterTags filters={glassFilters} active={activeGlass} onSelect={setActiveGlass} />

      <section>
        <div className="section-header">
          <h2>Basic people can&apos;t tell what it is&reg;</h2>
        </div>

        <div className="cocktail-list">
          {filtered.map((c) => (
            <CocktailCard key={c.id} cocktail={c} onClick={setSelected} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">:/</div>
            <div className="empty-state-text">Такого коктейля нет, но мы можем придумать</div>
          </div>
        )}
      </section>

      <footer className="footer">
        <div className="logo-text">Kollektiv</div>
        <p>Коктейльная карта</p>
      </footer>

      <BottomSheet cocktail={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
