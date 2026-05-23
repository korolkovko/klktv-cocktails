import { useMemo, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import CocktailEditor from './CocktailEditor';

export default function AdminPage() {
  const { cocktails, classics, families, reload } = useContent();
  const [tab, setTab] = useState('cocktails');
  const [editing, setEditing] = useState(null);  // entity object being edited
  const [creating, setCreating] = useState(false); // bool — show "new" editor
  const [busy, setBusy] = useState(false);

  const sortedCocktails = useMemo(
    () => [...cocktails].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [cocktails]
  );

  const onDeleteCocktail = async (c) => {
    if (!confirm(`Удалить «${c.name}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/cocktails/${encodeURIComponent(c.id)}`);
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
                  <button className="admin-btn" onClick={() => setEditing(c)} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDeleteCocktail(c)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'classics' && (
        <div className="admin-soon">
          Редактор классики появится в следующей итерации (C-2).
        </div>
      )}

      {tab === 'families' && (
        <div className="admin-soon">
          Редактор семейств появится в следующей итерации (C-2).
        </div>
      )}

      {(editing || creating) && (
        <CocktailEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={reload}
        />
      )}
    </>
  );
}
