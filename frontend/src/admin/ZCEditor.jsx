import { useMemo, useRef, useState } from 'react';
import { api } from '../auth/api';
import { useContent } from '../data/ContentContext';
import {
  TextField, TextArea, NumberField, SelectField, ParagraphsField, ImageField,
} from './FormFields';

export default function ZCEditor({ initial, onClose, onSaved }) {
  const { glassFilters } = useContent();
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    slug: initial?.id ?? '',
    name: initial?.name ?? '',
    img: initial?.img ?? '',
    is_alcoholic: initial?.isAlcoholic ?? true,
    price: initial?.price ?? '',
    abv: initial?.abv ?? '',
    glass_key: initial?.glassTag ?? '',
    glass_label_override: '',
    tagline: initial?.tagline ?? '',
    caffeine_level: initial?.caffeineLevel ?? null,
    is_carbonated: initial?.isCarbonated ?? null,
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
      is_alcoholic: form.is_alcoholic,
      price: form.price || null,
      abv: form.abv || null,
      glass_key: form.glass_key || null,
      glass_label_override: form.glass_label_override || null,
      tagline: form.tagline || null,
      caffeine_level: form.is_alcoholic ? null : (form.caffeine_level ?? null),
      is_carbonated: form.is_alcoholic ? null : (form.is_carbonated ?? null),
      details: form.details.filter((d) => d.label || d.text),
      sort_order: 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/zc-drinks/${encodeURIComponent(initial.id)}`, payload);
      } else {
        await api.post('/api/admin/zc-drinks', payload);
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
              {initial ? `Редактировать: ${initial.name}` : 'Новый Zero Culture'}
            </div>

            <TextField label="ID (slug)" value={form.slug} onChange={(v) => set('slug', v)} required />
            <TextField label="Название" value={form.name} onChange={(v) => set('name', v)} required />
            <ImageField label="Картинка" value={form.img} onChange={(v) => set('img', v)} />

            <div className="admin-field">
              <span className="admin-field-label">Тип</span>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button
                  type="button"
                  className={`admin-btn${form.is_alcoholic ? ' admin-btn--active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => set('is_alcoholic', true)}
                >Алко</button>
                <button
                  type="button"
                  className={`admin-btn${!form.is_alcoholic ? ' admin-btn--active' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => set('is_alcoholic', false)}
                >Non Alc</button>
              </div>
            </div>

            <TextField label="Цена" value={form.price} onChange={(v) => set('price', v)} placeholder="430 ₽" />
            <TextField label="ABV / формат" value={form.abv} onChange={(v) => set('abv', v)}
              placeholder={form.is_alcoholic ? '6,4 Alc / Coca Cola glass bottle 250ml' : 'Non Alc'} />
            <SelectField label="Бокал (если уместен)" value={form.glass_key} onChange={(v) => set('glass_key', v ?? '')} options={glassOptions} />
            <TextField label="Своё описание бокала/формата" value={form.glass_label_override} onChange={(v) => set('glass_label_override', v)}
              placeholder="Coca Cola glass bottle 250ml" hint="используется если в списке нет нужного варианта" />
            <TextArea label="Описание (tagline)" value={form.tagline} onChange={(v) => set('tagline', v)} rows={3}
              placeholder={form.is_alcoholic ? 'Ромовый, кисло-сладкий, умеренно пряный, газированный' : 'Травянистый, с лёгкой горечью'} />

            {!form.is_alcoholic && (
              <>
                <NumberField label="Уровень кофеина (1-3)" value={form.caffeine_level} onChange={(v) => set('caffeine_level', v)} placeholder="1, 2 или 3" />

                <div className="admin-field">
                  <span className="admin-field-label">Газация</span>
                  <div style={{ display: 'flex', gap: '.5rem' }}>
                    <button
                      type="button"
                      className={`admin-btn${form.is_carbonated === true ? ' admin-btn--active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => set('is_carbonated', true)}
                    >Да</button>
                    <button
                      type="button"
                      className={`admin-btn${form.is_carbonated === false ? ' admin-btn--active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => set('is_carbonated', false)}
                    >Нет</button>
                    <button
                      type="button"
                      className={`admin-btn${form.is_carbonated == null ? ' admin-btn--active' : ''}`}
                      style={{ flex: 1 }}
                      onClick={() => set('is_carbonated', null)}
                    >—</button>
                  </div>
                </div>
              </>
            )}

            <ParagraphsField label="Блоки рассказа (lore, что такое линейка, etc.)" items={form.details} onChange={(v) => set('details', v)} />

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
