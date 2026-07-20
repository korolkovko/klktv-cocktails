import { useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import {
  TextField, TextArea, NumberField, SelectField, ChipsField, ParagraphsField, ImageField,
} from './FormFields';
import { useEditorClose } from './useEditorClose';

const BADGES = [
  { value: 'premium', label: 'Премиум' },
  { value: 'onesip',  label: 'Onesip' },
  { value: 'bottle',  label: 'Bottle 250ml' },
  { value: 'hot',     label: 'Горячий' },
];

export default function CocktailEditor({ initial, onClose, onSaved }) {
  const { cocktails, glassFilters } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Build form state from initial cocktail (or empty for "new")
  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    name: initial?.name ?? '',
    img: initial?.img ?? '',
    abv: initial?.abv ?? '',
    glass_key: initial?.glassTag ?? '',
    badge_key: initial?.badge?.type ?? '',
    tagline: initial?.tagline ?? '',
    tags: [...(initial?.tags ?? [])],
    flavors: [...(initial?.flavors ?? [])],
    details: (initial?.details ?? []).map((d) => ({ ...d })),
    sort_order: 0,
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Build autocomplete suggestions from existing content
  const tagSuggestions = useMemo(() =>
    [...new Set(cocktails.flatMap((c) => c.tags))].sort(),
    [cocktails]
  );
  const flavorSuggestions = useMemo(() =>
    [...new Set(cocktails.flatMap((c) => c.flavors))].sort(),
    [cocktails]
  );
  const glassOptions = useMemo(() =>
    glassFilters
      .filter((f) => f.key !== 'all')
      .map((f) => ({ value: f.key, label: f.label })),
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
      abv: form.abv || null,
      glass_key: form.glass_key || null,
      badge_key: form.badge_key || null,
      badge_label: form.badge_key
        ? BADGES.find((b) => b.value === form.badge_key)?.label
        : null,
      tagline: form.tagline || null,
      tags: form.tags,
      flavors: form.flavors,
      details: form.details.filter((d) => d.label || d.text),
      sort_order: form.sort_order || 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/cocktails/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/cocktails', payload);
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
              {initial ? `Редактировать: ${initial.name}` : 'Новый коктейль'}
            </div>

            <TextField
              label="ID (slug)"
              value={form.slug}
              onChange={(v) => set('slug', v)}
              required
              hint="латиница, без пробелов. Используется в URL/связках. После создания лучше не менять."
            />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <ImageField
              label="Картинка"
              value={form.img}
              onChange={(v) => set('img', v)}
              hint="webp/jpg/png/avif, до 5 МБ. Можно загрузить файл или вставить путь вручную."
            />
            <TextField label="Крепость (ABV)" value={form.abv} onChange={(v) => set('abv', v)} placeholder="13.3%" />
            <SelectField
              label="Бокал"
              value={form.glass_key}
              onChange={(v) => set('glass_key', v ?? '')}
              options={glassOptions}
            />
            <SelectField
              label="Бейдж"
              value={form.badge_key}
              onChange={(v) => set('badge_key', v ?? '')}
              options={BADGES}
            />
            <TextArea label="Описание (tagline)" value={form.tagline} onChange={(v) => set('tagline', v)} rows={3} />
            <ChipsField
              label="Теги (для фильтра по спирту/категории)"
              values={form.tags}
              onChange={(v) => set('tags', v)}
              suggestions={tagSuggestions}
              hint="Enter / запятая чтобы добавить. Например: gin, sour, sweet"
            />
            <ChipsField
              label="Вкусовые ноты"
              values={form.flavors}
              onChange={(v) => set('flavors', v)}
              suggestions={flavorSuggestions}
              hint="Кисло-сладкий, Малина, Кардамон…"
            />
            <ParagraphsField
              label="Блоки рассказа"
              items={form.details}
              onChange={(v) => set('details', v)}
            />

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
