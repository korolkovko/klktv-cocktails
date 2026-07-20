import { useEffect, useState } from 'react';
import { api } from '../auth/api';

/**
 * Categories admin: rename, toggle visibility, reorder.
 *
 * Categories are structural (kind/key set in code), but their display —
 * label, sort order, visibility — is editable. New `kind`s (and the
 * tables they map to) arrive in D-3/D-4/D-5.
 */
export default function CategoriesTab({ onSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get('/api/admin/categories');
      list.sort((a, b) => a.sort_order - b.sort_order);
      setItems(list);
    } catch (e) {
      alert(`Не удалось загрузить категории: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const persist = async (updated) => {
    setSavingKey(updated.key);
    try {
      await api.patch(`/api/admin/categories/${encodeURIComponent(updated.key)}`, {
        label: updated.label,
        sort_order: updated.sort_order,
        is_visible: updated.is_visible,
      });
      await onSaved?.();
    } catch (e) {
      alert(`Не сохранилось: ${e.message}`);
      await load();
    } finally {
      setSavingKey(null);
    }
  };

  const toggleVisible = (c) => {
    const next = items.map((x) => x.key === c.key ? { ...x, is_visible: !x.is_visible } : x);
    setItems(next);
    persist({ ...c, is_visible: !c.is_visible });
  };

  const setLabel = (c, label) => {
    setItems(items.map((x) => x.key === c.key ? { ...x, label } : x));
  };

  const commitLabel = (c) => {
    if (c.label.trim() === '') return;
    persist(c);
  };

  const move = async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    // Renumber sort_order
    const reordered = next.map((c, idx) => ({ ...c, sort_order: idx }));
    setItems(reordered);
    try {
      await api.post('/api/admin/categories/reorder', {
        keys: reordered.map((c) => c.key),
      });
      await onSaved?.();
    } catch (e) {
      alert(`Не сохранил порядок: ${e.message}`);
      await load();
    }
  };

  return (
    <section>
      <div className="admin-list-head">
        <h2 className="admin-list-title">Категории навигации</h2>
        <div className="admin-field-hint" style={{ marginTop: 0 }}>
          порядок ↑↓ · название править прямо в поле · скрытые не видны в бургере
        </div>
      </div>
      {loading ? (
        <div className="admin-soon">Загружаю…</div>
      ) : (
        <div className="admin-list">
          {items.map((c, i) => (
            <div key={c.key} className="admin-list-row">
              <div className="admin-list-row-main">
                <input
                  type="text"
                  className="admin-cat-label"
                  value={c.label}
                  onChange={(e) => setLabel(c, e.target.value)}
                  onBlur={() => commitLabel(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  disabled={savingKey === c.key}
                />
                <div className="admin-list-row-sub">
                  <span>{c.key}</span>
                  <span>· kind: {c.kind}</span>
                  {!c.is_visible && <span style={{ color: 'var(--text-dim)' }}>· скрыта</span>}
                </div>
              </div>
              <div className="admin-list-row-actions">
                <button className="admin-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                <button className="admin-btn" onClick={() => move(i, +1)} disabled={i === items.length - 1}>↓</button>
                <button
                  className={`admin-btn${c.is_visible ? '' : ' admin-btn--danger'}`}
                  onClick={() => toggleVisible(c)}
                  disabled={savingKey === c.key}
                >
                  {c.is_visible ? 'Скрыть' : 'Показать'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
