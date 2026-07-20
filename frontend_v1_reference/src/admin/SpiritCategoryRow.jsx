import { useEffect, useState } from 'react';
import { api } from '../auth/api';

export default function SpiritCategoryRow({ category, entryCount, onChanged }) {
  const [label, setLabel] = useState(category.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(category.label); }, [category.label]);

  const persist = async (patch = {}) => {
    setSaving(true);
    try {
      await api.patch(`/api/admin/spirit-categories/${encodeURIComponent(category.slug)}`, {
        slug: category.slug,
        label: patch.label ?? label.trim() ?? category.label,
        sort_order: category.sort_order,
        is_archived: patch.is_archived ?? category.is_archived,
      });
      await onChanged?.();
    } catch (e) {
      alert(`Не сохранилось: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const commitLabel = async () => {
    if (!label.trim() || label === category.label) {
      setLabel(category.label);
      return;
    }
    await persist({ label: label.trim() });
  };

  const toggleArchive = () => persist({ is_archived: !category.is_archived });

  const remove = async () => {
    if (entryCount > 0) {
      alert(`В категории ${entryCount} позиций — перенесите их сначала.`);
      return;
    }
    if (!confirm(`Удалить категорию «${category.label}»?`)) return;
    try {
      await api.delete(`/api/admin/spirit-categories/${encodeURIComponent(category.slug)}`);
      await onChanged?.();
    } catch (e) {
      alert(`Не удалилось: ${e.message}`);
    }
  };

  return (
    <div className="admin-cat-row">
      <input
        type="text"
        className="admin-cat-label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <span className="admin-cat-count">{entryCount}</span>
      <button
        type="button"
        className={`admin-btn${category.is_archived ? ' admin-btn--active' : ''}`}
        onClick={toggleArchive}
        title={category.is_archived ? 'Вернуть в карту' : 'В архив'}
      >
        {category.is_archived ? 'Архив' : 'В карте'}
      </button>
      <button
        type="button"
        className="admin-btn admin-btn--danger"
        onClick={remove}
        disabled={entryCount > 0}
        title={entryCount > 0 ? 'Категория не пуста' : 'Удалить'}
      >×</button>
    </div>
  );
}
