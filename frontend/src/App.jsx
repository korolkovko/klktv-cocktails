import { useState, useMemo } from 'react';
import { useContent } from './data/ContentContext';
import { useAuth } from './auth/AuthContext';
import BurgerMenu from './components/BurgerMenu';
import Footer from './components/Footer';
import SearchBar from './components/SearchBar';
import FilterTags from './components/FilterTags';
import CocktailCard from './components/CocktailCard';
import BottomSheet from './components/BottomSheet';
import ClassicsPage from './pages/ClassicsPage';
import ZeroPage from './pages/ZeroPage';
import ZCPage from './pages/ZCPage';
import KitchenPage from './pages/KitchenPage';
import SpiritsPage from './pages/SpiritsPage';
import ProgressPage from './pages/ProgressPage';
import AdminPage from './admin/AdminPage';
import UsersPage from './admin/UsersPage';

export default function App() {
  const { user } = useAuth();
  const { categories, cocktails, spiritFilters, glassFilters } = useContent();
  // Burger shows only visible categories. We render `kind`-based pages
  // (so admin can rename "Меню" without breaking routing).
  const burgerItems = useMemo(
    () => (categories || []).filter((c) => c.is_visible).map((c) => ({ key: c.kind, label: c.label })),
    [categories]
  );
  const [page, setPage] = useState('menu');
  const [search, setSearch] = useState('');
  const [activeSpirit, setActiveSpirit] = useState('all');
  const [activeGlass, setActiveGlass] = useState('all');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    let list = cocktails;
    if (activeSpirit !== 'all') list = list.filter((c) => c.tags.includes(activeSpirit));
    if (activeGlass !== 'all') list = list.filter((c) => c.glassTag === activeGlass);
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q) ||
        c.flavors.some((f) => f.toLowerCase().includes(q))
      );
    }
    return list;
  }, [cocktails, search, activeSpirit, activeGlass]);

  // When the user navigates between public categories via the burger, fall
  // back to 'menu' on logout etc.
  const onSelectCategory = (key) => {
    setPage(key);
    setSelected(null);
  };

  return (
    <div className="container">
      <BurgerMenu items={burgerItems} active={page} onSelect={onSelectCategory} />

      {page === 'menu' && (
        <>
          <SearchBar value={search} onChange={setSearch} />
          <FilterTags
            filters={spiritFilters}
            active={activeSpirit}
            onSelect={setActiveSpirit}
            className="nav-tags--menu-1"
          />
          <FilterTags
            filters={glassFilters}
            active={activeGlass}
            onSelect={setActiveGlass}
            className="nav-tags--menu-2"
          />

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
        </>
      )}

      {page === 'classics' && (
        <ClassicsPage onOpenAuthorCocktail={setSelected} />
      )}

      {page === 'zero' && <ZeroPage />}
      {page === 'zc' && <ZCPage />}
      {page === 'kitchen' && <KitchenPage />}
      {page === 'spirits' && <SpiritsPage />}
      {page === 'progress' && <ProgressPage onOpenCategory={(k) => setPage(k)} />}

      {page === 'admin' && <AdminPage />}
      {page === 'users' && <UsersPage />}

      <Footer
        onOpenAdmin={() => { setPage('admin'); setSelected(null); }}
        onOpenUsers={() => { setPage('users'); setSelected(null); }}
        onOpenProgress={() => { setPage('progress'); setSelected(null); }}
      />

      <BottomSheet cocktail={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
