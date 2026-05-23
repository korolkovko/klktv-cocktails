import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import { TextField, TextArea, SelectField, ImageField } from './FormFields';

export default function SpiritEditor({ initial, onClose, onSaved }) {
  const { spiritCategories } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    category_slug: initial?.categorySlug ?? (spiritCategories[0]?.slug ?? ''),
    name: initial?.name ?? '',
    img: initial?.img ?? '',
    abv: initial?.abv ?? '',
    price: initial?.price ?? '',
    flavour: initial?.flavour ?? '',
    brand: initial?.brand ?? '',
    country: initial?.country ?? '',
    brand_country: initial?.brandCountry ?? '',
    source_url: initial?.sourceUrl ?? '',
    features: initial?.features ?? '',
    cocktail_pairings: initial?.cocktailPairings ?? '',
    fact: initial?.fact ?? '',
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const catOptions = useMemo(() =>
    [...spiritCategories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((c) => ({ value: c.slug, label: c.label + (c.is_archived ? ' · архив' : '') })),
    [spiritCategories]
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
      abv: form.abv || null,
      price: form.price || null,
      flavour: form.flavour || null,
      brand: form.brand || null,
      country: form.country || null,
      brand_country: form.brand_country || null,
      source_url: form.source_url || null,
      features: form.features || null,
      cocktail_pairings: form.cocktail_pairings || null,
      fact: form.fact || null,
      sort_order: 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/spirit-entries/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/spirit-entries', payload);
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
              {initial ? `Редактировать: ${initial.name}` : 'Новая позиция'}
            </div>

            <TextField label="ID (slug)" value={form.slug} onChange={(v) => set('slug', v)} required
              hint="латиница, без пробелов" />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <SelectField label="Категория" value={form.category_slug} onChange={(v) => set('category_slug', v ?? '')} options={catOptions} allowEmpty={false} />
            <ImageField label="Картинка бутылки" value={form.img} onChange={(v) => set('img', v)} />
            <TextField label="ABV (%)" value={form.abv} onChange={(v) => set('abv', v)} placeholder="40" />
            <TextField label="Цена" value={form.price} onChange={(v) => set('price', v)} placeholder="550 за 30 мл" />
            <TextArea label="Flavour / вкус" value={form.flavour} onChange={(v) => set('flavour', v)} rows={3} />
            <TextField label="Бренд" value={form.brand} onChange={(v) => set('brand', v)}
              placeholder="Destileria Orendain" />
            <TextField label="Страна / регион" value={form.country} onChange={(v) => set('country', v)}
              placeholder="Шотландия, Спейсайд" />
            <TextArea label="Подробно про бренд" value={form.brand_country} onChange={(v) => set('brand_country', v)} rows={4}
              hint="История компании, особенности производства — всё, что не помещается в короткие поля выше" />
            <TextField label="Ссылка" value={form.source_url} onChange={(v) => set('source_url', v)}
              placeholder="https://..." hint="официальный сайт или каталог" />
            <TextArea label="Особенности" value={form.features} onChange={(v) => set('features', v)} rows={3} />
            <TextArea label="В каких коктейлях" value={form.cocktail_pairings} onChange={(v) => set('cocktail_pairings', v)} rows={2}
              placeholder="Маргарита&#10;Негрони" />
            <TextArea label="Занимательный факт" value={form.fact} onChange={(v) => set('fact', v)} rows={3} />

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
