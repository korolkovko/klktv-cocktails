import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import { TextField, TextArea, SelectField, ImageField } from './FormFields';

export default function KitchenEditor({ initial, onClose, onSaved }) {
  const { kitchenCategories } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    category_slug: initial?.categorySlug ?? (kitchenCategories[0]?.slug ?? ''),
    name: initial?.name ?? '',
    img: initial?.img ?? '',
    description: initial?.description ?? '',
    timing: initial?.timing ?? '',
    weight: initial?.weight ?? '',
    nutrition: initial?.nutrition ?? '',
    serving: initial?.serving ?? '',
    interesting_facts: initial?.interestingFacts ?? '',
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const catOptions = useMemo(() =>
    [...kitchenCategories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ value: c.slug, label: c.label })),
    [kitchenCategories]
  );

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const onWrap = (e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.name.trim() || !form.category_slug) {
      setError('slug, name и категория обязательны');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      slug: form.slug.trim(),
      category_slug: form.category_slug,
      name: form.name.trim(),
      img: form.img || null,
      description: form.description || null,
      timing: form.timing || null,
      weight: form.weight || null,
      nutrition: form.nutrition || null,
      serving: form.serving || null,
      interesting_facts: form.interesting_facts || null,
      sort_order: 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/kitchen-dishes/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/kitchen-dishes', payload);
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
      setSaving(false);
    }
  };

  return (
    <div className="sheet-wrapper open" onClick={onWrap}>
      <div className="sheet-container">
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef}>
          <form className="sheet-body admin-form" onSubmit={submit}>
            <div className="sheet-name">
              {initial ? `Редактировать: ${initial.name}` : 'Новое блюдо'}
            </div>

            <TextField label="ID (slug)" value={form.slug} onChange={(v) => set('slug', v)} required
              hint="латиница, без пробелов" />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <SelectField label="Категория" value={form.category_slug} onChange={(v) => set('category_slug', v ?? '')} options={catOptions} allowEmpty={false} />
            <ImageField label="Эталон подачи (картинка)" value={form.img} onChange={(v) => set('img', v)}
              hint="опционально — можно добавить когда сделаем фото эталонной подачи" />
            <TextArea label="Состав" value={form.description} onChange={(v) => set('description', v)} rows={3}
              placeholder="Филе цыплёнка бройлера маринованное в мисо пасте..." />
            <TextField label="Тайминг (мин)" value={form.timing} onChange={(v) => set('timing', v)} placeholder="10 или 10-12" />
            <TextField label="Выход (г)" value={form.weight} onChange={(v) => set('weight', v)} placeholder="280 или 320/50" />
            <TextArea label="Пищевая ценность" value={form.nutrition} onChange={(v) => set('nutrition', v)} rows={3}
              placeholder="На порцию б 30,24 ж 11,91 у 136,45 784 ккал" />
            <TextArea label="Сервировка" value={form.serving} onChange={(v) => set('serving', v)} rows={2}
              placeholder="Подается в стальной форме, с вилкой и салфеткой" />
            <TextArea label="Интересные факты" value={form.interesting_facts} onChange={(v) => set('interesting_facts', v)} rows={3}
              placeholder="Откуда рецепт, что необычного в составе, история блюда…" />

            {error && <div className="login-error">{error}</div>}

            <div className="admin-form-actions">
              <button type="button" className="admin-btn" onClick={onClose} disabled={saving}>Отмена</button>
              <button type="submit" className="login-submit" disabled={saving}>
                {saving ? 'Сохраняю…' : (initial ? 'Сохранить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
