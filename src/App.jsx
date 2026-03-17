import { useState, useMemo } from 'react';
import { cocktails } from './data/cocktails';
import SearchBar from './components/SearchBar';
import CocktailCard from './components/CocktailCard';
import BottomSheet from './components/BottomSheet';

export default function App() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cocktails;
    return cocktails.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.flavors.some((f) => f.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <div className="container">
      <SearchBar value={search} onChange={setSearch} />

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
