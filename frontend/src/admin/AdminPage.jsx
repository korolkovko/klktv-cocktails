import { useMemo, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import CocktailEditor from './CocktailEditor';
import ClassicEditor from './ClassicEditor';
import FamilyEditor from './FamilyEditor';
import ZeroEditor from './ZeroEditor';
import ZCEditor from './ZCEditor';
import KitchenEditor from './KitchenEditor';
import KitchenCategoryRow from './KitchenCategoryRow';
import CategoriesTab from './CategoriesTab';

/**
 * Content management (admin or editor). User management is at /users
 * (separate footer link). Categories editing arrives in D-2.
 */
export default function AdminPage() {
  const { cocktails, classics, families, zeroCocktails, zcDrinks, kitchenCategories, kitchenDishes, reload } = useContent();
  const [tab, setTab] = useState('cocktails');
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const editorEntity = editing
    ? (editing._kind || tab)
    : (creating ? tab : null);

  const sortedCocktails = useMemo(
    () => [...cocktails].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [cocktails]
  );
  const sortedClassics = useMemo(
    () => [...classics].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [classics]
  );
  const sortedFamilies = useMemo(
    () => [...families].sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    [families]
  );
  const sortedZero = useMemo(
    () => [...zeroCocktails].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [zeroCocktails]
  );
  const sortedZC = useMemo(
    () => [...zcDrinks].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [zcDrinks]
  );
  // Kitchen dishes grouped by category (preserves category sort order)
  const dishesByCategory = useMemo(() => {
    const cats = [...kitchenCategories].sort((a, b) => a.sort_order - b.sort_order);
    return cats.map((c) => ({
      ...c,
      dishes: kitchenDishes
        .filter((d) => d.categorySlug === c.slug)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    }));
  }, [kitchenCategories, kitchenDishes]);

  const closeEditor = () => { setEditing(null); setCreating(false); };

  const onDelete = async (kind, identifier, displayName) => {
    if (!confirm(`Удалить «${displayName}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/${kind}/${encodeURIComponent(identifier)}`);
      await reload();
    } catch (e) {
      alert(`Не удалось удалить: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-subtabs">
        <button
          className={`admin-subtab${tab === 'cocktails' ? ' active' : ''}`}
          onClick={() => setTab('cocktails')}
        >
          Меню · {cocktails.length}
        </button>
        <button
          className={`admin-subtab${tab === 'classics' ? ' active' : ''}`}
          onClick={() => setTab('classics')}
        >
          Классика · {classics.length}
        </button>
        <button
          className={`admin-subtab${tab === 'families' ? ' active' : ''}`}
          onClick={() => setTab('families')}
        >
          Семейства · {families.length}
        </button>
        <button
          className={`admin-subtab${tab === 'zero' ? ' active' : ''}`}
          onClick={() => setTab('zero')}
        >
          Безалко · {zeroCocktails.length}
        </button>
        <button
          className={`admin-subtab${tab === 'zc' ? ' active' : ''}`}
          onClick={() => setTab('zc')}
        >
          Zero Culture · {zcDrinks.length}
        </button>
        <button
          className={`admin-subtab${tab === 'kitchen' ? ' active' : ''}`}
          onClick={() => setTab('kitchen')}
        >
          Кухня · {kitchenDishes.length}
        </button>
        <button
          className={`admin-subtab${tab === 'categories' ? ' active' : ''}`}
          onClick={() => setTab('categories')}
        >
          Категории
        </button>
      </div>

      {tab === 'cocktails' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Авторские коктейли</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новый коктейль
            </button>
          </div>
          <div className="admin-list">
            {sortedCocktails.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">{c.name}</div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    {c.abv && <span>· {c.abv}</span>}
                    {c.glass && <span>· {c.glass}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'cocktails' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('cocktails', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'classics' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Классические коктейли</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новая классика
            </button>
          </div>
          <div className="admin-list">
            {sortedClassics.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">{c.name}</div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    <span>· {c.family}</span>
                    {c.year && <span>· {c.year}</span>}
                    {c.origin && <span>· {c.origin}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'classics' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('classics', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'families' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Семейства классики</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новое семейство
            </button>
          </div>
          <div className="admin-list">
            {sortedFamilies.map((f) => (
              <div key={f.key} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: f.color || '#555',
                        marginRight: 8,
                        verticalAlign: 'middle',
                      }}
                    />
                    {f.label}
                  </div>
                  <div className="admin-list-row-sub">
                    <span>{f.key}</span>
                    {f.sub && <span>· {f.sub}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...f, _kind: 'families' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('families', f.key, f.label)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'zero' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Безалкогольные коктейли</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новый безалко
            </button>
          </div>
          <div className="admin-list">
            {sortedZero.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">{c.name}</div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    {c.price && <span>· {c.price}</span>}
                    {c.glass && <span>· {c.glass}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'zero' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('zero-cocktails', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'zc' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Zero Culture</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новый ZC
            </button>
          </div>
          <div className="admin-list">
            {sortedZC.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">
                    <span className={`zc-badge zc-badge--${c.isAlcoholic ? 'alc' : 'non'}`} style={{ position: 'static', marginRight: 8 }}>
                      {c.isAlcoholic ? 'Alc' : 'Non'}
                    </span>
                    {c.name}
                  </div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    {c.price && <span>· {c.price}</span>}
                    {!c.isAlcoholic && c.caffeineLevel != null && <span>· кофеин {c.caffeineLevel}/3</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'zc' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('zc-drinks', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'kitchen' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Кухня</h2>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              <button className="admin-btn" onClick={async () => {
                const label = prompt('Название новой категории:');
                if (!label || !label.trim()) return;
                const slug = prompt('Slug (латиница, без пробелов):', label.trim().toLowerCase().replace(/\s+/g, '-'));
                if (!slug || !slug.trim()) return;
                try {
                  await api.post('/api/admin/kitchen-categories', {
                    slug: slug.trim(),
                    label: label.trim(),
                    sort_order: kitchenCategories.length,
                  });
                  await reload();
                } catch (e) { alert(e.message); }
              }}>+ Категория</button>
              <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
                + Новое блюдо
              </button>
            </div>
          </div>
          {dishesByCategory.map((cat) => (
            <div key={cat.slug} style={{ marginBottom: '1.5rem' }}>
              <KitchenCategoryRow category={cat} dishCount={cat.dishes.length} onChanged={reload} />
              <div className="admin-list">
                {cat.dishes.map((d) => (
                  <div key={d.id} className="admin-list-row">
                    <div className="admin-list-row-main">
                      <div className="admin-list-row-name">{d.name}</div>
                      <div className="admin-list-row-sub">
                        <span>{d.id}</span>
                        {d.timing && <span>· {d.timing} мин</span>}
                        {d.weight && <span>· {d.weight} г</span>}
                      </div>
                    </div>
                    <div className="admin-list-row-actions">
                      <button className="admin-btn" onClick={() => setEditing({ ...d, _kind: 'kitchen' })} disabled={busy}>Изменить</button>
                      <button className="admin-btn admin-btn--danger" onClick={() => onDelete('kitchen-dishes', d.id, d.name)} disabled={busy}>Удалить</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'categories' && <CategoriesTab onSaved={reload} />}

      {editorEntity === 'cocktails' && (editing || creating) && (
        <CocktailEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'classics' && (editing || creating) && (
        <ClassicEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'families' && (editing || creating) && (
        <FamilyEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'zero' && (editing || creating) && (
        <ZeroEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'zc' && (editing || creating) && (
        <ZCEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'kitchen' && (editing || creating) && (
        <KitchenEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
    </>
  );
}
