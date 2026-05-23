import { useEffect, useRef, useState } from 'react';
import { api } from '../auth/api';
import {
  TextField, TextArea, ColorField,
} from './FormFields';

export default function FamilyEditor({ initial, onClose, onSaved }) {
  const sheetRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    key: initial?.key ?? '',
    label: initial?.label ?? '',
    sub: initial?.sub ?? '',
    color: initial?.color ?? '#888888',
    logic: initial?.logic ?? '',
    evolution: initial?.evolution ?? '',
    tip: initial?.tip ?? '',
    sort_order: 0,
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

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
    if (!form.key.trim() || !form.label.trim()) {
      setError('key и label обязательны');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      key: form.key.trim(),
      label: form.label.trim(),
      sub: form.sub || null,
      color: form.color || null,
      logic: form.logic || null,
      evolution: form.evolution || null,
      tip: form.tip || null,
      sort_order: form.sort_order || 0,
    };
    try {
      if (initial) {
        await api.patch(`/api/admin/families/${encodeURIComponent(initial.key)}`, payload);
      } else {
        await api.post('/api/admin/families', payload);
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
              {initial ? `Редактировать: ${initial.label}` : 'Новое семейство'}
            </div>

            <TextField
              label="Ключ (key)"
              value={form.key}
              onChange={(v) => set('key', v)}
              required
              hint="латиница, без пробелов. Например: sour, negroni, martini. На него ссылаются классики."
            />
            <TextField label="Название" value={form.label} onChange={(v) => set('label', v)} required />
            <TextField label="Подзаголовок" value={form.sub} onChange={(v) => set('sub', v)} placeholder="Кислые — фундамент миксологии" />
            <ColorField label="Цвет" value={form.color} onChange={(v) => set('color', v)} />
            <TextArea
              label="Логика семейства"
              value={form.logic}
              onChange={(v) => set('logic', v)}
              rows={3}
              hint="Что объединяет коктейли этого семейства"
            />
            <TextArea
              label="Эволюция"
              value={form.evolution}
              onChange={(v) => set('evolution', v)}
              rows={2}
              hint="Цепочка: А → Б → В…"
            />
            <TextArea
              label="Tip"
              value={form.tip}
              onChange={(v) => set('tip', v)}
              rows={3}
              hint="Совет в карточке семейства (отображается с иконкой 💡)"
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
