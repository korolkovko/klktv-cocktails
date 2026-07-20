import { useRef, useState } from 'react';
import { api, resolveImageUrl } from '../auth/api';

/**
 * Single-line text field.
 *   <TextField label="Название" value={...} onChange={...} required />
 */
export function TextField({ label, value, onChange, required, placeholder, hint }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}{required && ' *'}</span>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
      {hint && <span className="admin-field-hint">{hint}</span>}
    </label>
  );
}

/**
 * Image upload + preview. Stores the resulting URL/path as the value.
 * If the editor pastes a manual path (legacy /logos/...), it still works —
 * the upload button is one option, the text input is the other.
 */
export function ImageField({ label, value, onChange, hint }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/api/admin/uploads/image', fd);
      onChange(res.url);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const preview = value ? resolveImageUrl(value) : null;

  return (
    <div className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-image-field">
        {preview && (
          <div className="admin-image-preview">
            <img src={preview} alt="" />
          </div>
        )}
        <div className="admin-image-controls">
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/static/img/file.webp или /logos/file.webp"
          />
          <div className="admin-image-actions">
            <button type="button" className="admin-btn" onClick={pick} disabled={uploading}>
              {uploading ? 'Загружаю…' : 'Загрузить файл'}
            </button>
            {value && (
              <button type="button" className="admin-btn admin-btn--danger" onClick={() => onChange('')}>
                Очистить
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/webp,image/jpeg,image/png,image/avif"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>
      {error && <span className="admin-field-hint" style={{ color: 'var(--accent)' }}>{error}</span>}
      {hint && !error && <span className="admin-field-hint">{hint}</span>}
    </div>
  );
}

/** Native color picker + hex text input side by side. */
export function ColorField({ label, value, onChange }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-color-row">
        <input
          type="color"
          value={value || '#888888'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#aabbcc"
          className="admin-color-hex"
        />
      </div>
    </label>
  );
}

/** Multi-line text. */
export function TextArea({ label, value, onChange, rows = 4, placeholder, hint }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
      {hint && <span className="admin-field-hint">{hint}</span>}
    </label>
  );
}

/**
 * Integer field. Empty string maps to null.
 */
export function NumberField({ label, value, onChange, placeholder }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : parseInt(v, 10));
        }}
        placeholder={placeholder}
      />
    </label>
  );
}

/**
 * <option> select with "(пусто)" entry mapped to null.
 *   options = [{value, label}, ...]
 */
export function SelectField({ label, value, onChange, options, allowEmpty = true }) {
  return (
    <label className="admin-field">
      <span className="admin-field-label">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        {allowEmpty && <option value="">— нет —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Chip-style multi-value input. Suggestions show as a datalist for
 * autocomplete. Editor types a value and presses Enter / comma to add it.
 *
 *   <ChipsField label="Теги" values={tags} onChange={setTags} suggestions={[...]} />
 */
export function ChipsField({ label, values, onChange, suggestions = [], hint }) {
  const [draft, setDraft] = useState('');
  const listId = `chip-suggest-${label}`;

  const add = (v) => {
    const t = (v ?? draft).trim();
    if (!t) return;
    if (values.includes(t)) { setDraft(''); return; }
    onChange([...values, t]);
    setDraft('');
  };
  const remove = (v) => onChange(values.filter((x) => x !== v));

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && draft === '' && values.length) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="admin-field">
      <span className="admin-field-label">{label}</span>
      <div className="admin-chips-wrap">
        {values.map((v) => (
          <span key={v} className="admin-chip">
            {v}
            <button type="button" className="admin-chip-x" onClick={() => remove(v)}>×</button>
          </span>
        ))}
        <input
          type="text"
          className="admin-chip-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add()}
          list={suggestions.length ? listId : undefined}
          placeholder="добавить…"
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        )}
      </div>
      {hint && <span className="admin-field-hint">{hint}</span>}
    </div>
  );
}

/**
 * Repeated paragraph block (label + text). Used for cocktail.details
 * and similar 1-to-many list-of-objects fields.
 *
 *   <ParagraphsField items={details} onChange={setDetails} />
 */
export function ParagraphsField({ label, items, onChange }) {
  const update = (i, key, v) => {
    const next = items.map((it, idx) => idx === i ? { ...it, [key]: v } : it);
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { label: '', text: '' }]);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="admin-field">
      <span className="admin-field-label">{label}</span>
      {items.map((it, i) => (
        <div key={i} className="admin-paragraph">
          <div className="admin-paragraph-head">
            <input
              type="text"
              className="admin-paragraph-label"
              value={it.label}
              onChange={(e) => update(i, 'label', e.target.value)}
              placeholder="Заголовок (напр., «О коктейле»)"
            />
            <div className="admin-paragraph-actions">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" onClick={() => move(i, +1)} disabled={i === items.length - 1}>↓</button>
              <button type="button" onClick={() => remove(i)} title="Удалить">×</button>
            </div>
          </div>
          <textarea
            value={it.text}
            onChange={(e) => update(i, 'text', e.target.value)}
            rows={4}
            placeholder="Текст…"
          />
        </div>
      ))}
      <button type="button" className="admin-add-btn" onClick={add}>+ Добавить блок</button>
    </div>
  );
}
