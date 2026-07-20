import { useEffect, useState } from 'react';
import { api } from '../auth/api';

/**
 * Header for one kitchen category in admin: inline rename + delete + count.
 * Used inline above the dish list inside the "Кухня" admin sub-tab.
 */
export default function KitchenCategoryRow({ category, dishCount, onChanged }) {
  const [label, setLabel] = useState(category.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabel(category.label); }, [category.label]);

  const commit = async () => {
    if (!label.trim() || label === category.label) {
      setLabel(category.label);
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/api/admin/kitchen-categories/${encodeURIComponent(category.slug)}`, {
        slug: category.slug,
        label: label.trim(),
        sort_order: category.sort_order,
      });
      await onChanged?.();
    } catch (e) {
      alert(`Не удалось переименовать: ${e.message}`);
      setLabel(category.label);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (dishCount > 0) {
      alert(`В категории ${dishCount} блюд — перенесите их в другую категорию сначала.`);
      return;
    }
    if (!confirm(`Удалить категорию «${category.label}»?`)) return;
    try {
      await api.delete(`/api/admin/kitchen-categories/${encodeURIComponent(category.slug)}`);
      await onChanged?.();
    } catch (e) {
      alert(`Не удалось удалить: ${e.message}`);
    }
  };

  return (
    <div className="admin-cat-row">
      <input
        type="text"
        className="admin-cat-label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <span className="admin-cat-count">{dishCount}</span>
      <button
        type="button"
        className="admin-btn admin-btn--danger"
        onClick={remove}
        disabled={dishCount > 0}
        title={dishCount > 0 ? 'Категория не пуста' : 'Удалить'}
      >×</button>
    </div>
  );
}
