import { useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import {
  TextField, TextArea, SelectField, ParagraphsField, ImageField,
} from './FormFields';
import { useEditorClose } from './useEditorClose';

export default function ZeroEditor({ initial, onClose, onSaved }) {
  const { glassFilters } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    name: initial?.name ?? '',
    img: initial?.img ?? '',
    price: initial?.price ?? '',
    abv: initial?.abv ?? 'Non Alc',
    glass_key: initial?.glassTag ?? '',
    tagline: initial?.tagline ?? '',
    ingredients_text: (initial?.ingredients ?? []).join('\n'),
    details: (initial?.details ?? []).map((d) => ({ ...d })),
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const glassOptions = useMemo(() =>
    glassFilters.filter((f) => f.key !== 'all').map((f) => ({ value: f.key, label: f.label })),
    [glassFilters]
  );

  // Close-with-confirm on Escape / click outside (dirty-aware)
  const safeClose = useEditorClose(form, onClose);

  const onWrap = (e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) safeClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.name.trim()) {
      setError('slug и name обязательны');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      img: form.img || null,
      price: form.price || null,
      abv: form.abv || null,
      glass_key: form.glass_key || null,
      tagline: form.tagline || null,
      ingredients_text: form.ingredients_text || null,
      details: form.details.filter((d) => d.label || d.text),
      sort_order: 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/zero-cocktails/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/zero-cocktails', payload);
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
        <button className="sheet-close" onClick={safeClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef}>
          <form className="sheet-body admin-form" onSubmit={submit}>
            <div className="sheet-name">
              {initial ? `Редактировать: ${initial.name}` : 'Новый безалко коктейль'}
            </div>

            <TextField label="ID (slug)" value={form.slug} onChange={(v) => set('slug', v)} required
              hint="латиница, без пробелов." />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <ImageField label="Картинка" value={form.img} onChange={(v) => set('img', v)} />
            <TextField label="Цена" value={form.price} onChange={(v) => set('price', v)} placeholder="430 ₽" />
            <TextField label="ABV / метка" value={form.abv} onChange={(v) => set('abv', v)} placeholder="Non Alc" />
            <SelectField label="Бокал" value={form.glass_key} onChange={(v) => set('glass_key', v ?? '')} options={glassOptions} />
            <TextArea label="Описание (tagline)" value={form.tagline} onChange={(v) => set('tagline', v)} rows={3}
              placeholder="Безалкогольный газированный твист на Американо с малиновой пеной" />
            <TextArea label="В составе (по строке на ингредиент)" value={form.ingredients_text} onChange={(v) => set('ingredients_text', v)} rows={5}
              placeholder="Red Bitter от NoTails&#10;Кордиал из каркаде и перца кубеба&#10;Малиновая пена из Gentle Cloud" />
            <ParagraphsField label="Блоки рассказа (вкус / lore / etc.)" items={form.details} onChange={(v) => set('details', v)} />

            {error && <div className="login-error">{error}</div>}

            <div className="admin-form-actions">
              <button type="button" className="admin-btn" onClick={safeClose} disabled={saving}>Отмена</button>
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
