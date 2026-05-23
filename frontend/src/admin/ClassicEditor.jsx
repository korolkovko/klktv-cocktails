import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import {
  TextField, TextArea, NumberField, SelectField, ChipsField,
} from './FormFields';

// Spirit options match the original ClassicsPage filter — could be derived
// from the families/spirits in content, but this list is canonical labels
// and rarely changes.
const SPIRIT_OPTIONS = [
  { value: 'gin', label: 'Джин' },
  { value: 'vodka', label: 'Водка' },
  { value: 'rum', label: 'Ром' },
  { value: 'whiskey', label: 'Виски' },
  { value: 'brandy', label: 'Бренди' },
  { value: 'tequila', label: 'Текила' },
  { value: 'mezcal', label: 'Мескаль' },
  { value: 'other', label: 'Аперитив' },
  { value: 'bourbon', label: 'Бурбон' },
];

export default function ClassicEditor({ initial, onClose, onSaved }) {
  const { classics, cocktails, families, glassFilters } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    name: initial?.name ?? '',
    family_key: initial?.family ?? (families[0]?.key ?? ''),
    year: initial?.year ?? null,
    origin: initial?.origin ?? '',
    spirits: [...(initial?.spirits ?? [])],
    composition: initial?.composition ?? '',
    glass_key: initial?.glassTag ?? '',
    garnish: initial?.garnish ?? '',
    descriptors: [...(initial?.descriptors ?? [])],
    history: initial?.history ?? '',
    for_whom: initial?.forWhom ?? '',
    related_ours: [...(initial?.relatedOurs ?? [])],
    sort_order: 0,
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const descriptorSuggestions = useMemo(() =>
    [...new Set(classics.flatMap((c) => c.descriptors))].sort(),
    [classics]
  );

  const familyOptions = useMemo(() =>
    families.map((f) => ({ value: f.key, label: f.label })),
    [families]
  );

  const glassOptions = useMemo(() => {
    // Combine cocktail glass filters + glass keys observed on classics
    const seen = new Set();
    const out = [];
    for (const f of glassFilters) {
      if (f.key !== 'all' && !seen.has(f.key)) {
        seen.add(f.key); out.push({ value: f.key, label: f.label });
      }
    }
    for (const c of classics) {
      if (c.glassTag && !seen.has(c.glassTag)) {
        seen.add(c.glassTag);
        out.push({ value: c.glassTag, label: c.glass || c.glassTag });
      }
    }
    return out;
  }, [glassFilters, classics]);

  // For relatedOurs: suggest cocktail slugs and show the names next to them.
  const cocktailSlugs = useMemo(() => cocktails.map((c) => c.id).sort(), [cocktails]);
  const cocktailNameBySlug = useMemo(() => {
    const m = {};
    for (const c of cocktails) m[c.id] = c.name;
    return m;
  }, [cocktails]);

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
    if (!form.slug.trim() || !form.name.trim() || !form.family_key) {
      setError('slug, name и family — обязательны');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      family_key: form.family_key,
      year: form.year ?? null,
      origin: form.origin || null,
      spirits: form.spirits,
      composition: form.composition || null,
      glass_key: form.glass_key || null,
      garnish: form.garnish || null,
      descriptors: form.descriptors,
      history: form.history || null,
      for_whom: form.for_whom || null,
      related_ours: form.related_ours,
      sort_order: form.sort_order || 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/classics/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/classics', payload);
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
              {initial ? `Редактировать: ${initial.name}` : 'Новая классика'}
            </div>

            <TextField
              label="ID (slug)"
              value={form.slug}
              onChange={(v) => set('slug', v)}
              required
              hint="латиница, например whiskey_sour. После создания лучше не менять (на этот slug ссылается прогресс юзеров)"
            />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <SelectField
              label="Семейство"
              value={form.family_key}
              onChange={(v) => set('family_key', v ?? '')}
              options={familyOptions}
              allowEmpty={false}
            />
            <NumberField label="Год создания" value={form.year} onChange={(v) => set('year', v)} placeholder="1862" />
            <TextField label="Происхождение" value={form.origin} onChange={(v) => set('origin', v)} placeholder="США, Перу, Париж…" />
            <ChipsField
              label="Спирты"
              values={form.spirits}
              onChange={(v) => set('spirits', v)}
              suggestions={SPIRIT_OPTIONS.map((s) => s.value)}
              hint={`варианты: ${SPIRIT_OPTIONS.map((s) => `${s.value} (${s.label})`).join(', ')}`}
            />
            <TextArea label="Состав" value={form.composition} onChange={(v) => set('composition', v)} rows={3} />
            <SelectField
              label="Бокал"
              value={form.glass_key}
              onChange={(v) => set('glass_key', v ?? '')}
              options={glassOptions}
            />
            <TextField label="Гарниш" value={form.garnish} onChange={(v) => set('garnish', v)} />
            <ChipsField
              label="Дескрипторы (вкусовые ноты)"
              values={form.descriptors}
              onChange={(v) => set('descriptors', v)}
              suggestions={descriptorSuggestions}
              hint="Кисло-сладкий, Пряный, Дымный…"
            />
            <TextArea label="История" value={form.history} onChange={(v) => set('history', v)} rows={5} />
            <TextArea label="Кому подходит" value={form.for_whom} onChange={(v) => set('for_whom', v)} rows={2} />
            <ChipsField
              label="Связанные авторские коктейли"
              values={form.related_ours}
              onChange={(v) => set('related_ours', v)}
              suggestions={cocktailSlugs}
              hint={
                form.related_ours.length
                  ? form.related_ours.map((s) => `${s} → ${cocktailNameBySlug[s] || '(нет в БД)'}`).join('; ')
                  : 'slug коктейля из вашего меню (показывается как «наш ответ» в карточке классики)'
              }
            />

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
