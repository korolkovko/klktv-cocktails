import { useRef, useState } from 'react';
import { api } from '../auth/api';
import { TextField, SelectField } from './FormFields';
import { useEditorClose } from './useEditorClose';

const ROLES = [
  { value: 'admin',  label: 'Админ (всё + управление юзерами)' },
  { value: 'editor', label: 'Редактор (правит контент)' },
  { value: 'reader', label: 'Читатель (только смотрит)' },
];

export default function UserEditor({ initial, onClose, onSaved }) {
  const sheetRef = useRef(null);
  const isNew = !initial;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState(() => ({
    username: initial?.username ?? '',
    name: initial?.name ?? '',
    role: initial?.role ?? 'reader',
    password: '',          // empty == "don't change" on edit; required on create
  }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Close-with-confirm on Escape / click outside (dirty-aware)
  const safeClose = useEditorClose(form, onClose);

  const onWrap = (e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) safeClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isNew) {
      if (!form.username.trim() || !form.password) {
        setError('username и password обязательны при создании');
        return;
      }
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/admin/users', {
          username: form.username.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          name: form.name || null,
        });
      } else {
        const payload = {
          role: form.role,
          name: form.name || null,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/api/admin/users/${encodeURIComponent(initial.username)}`, payload);
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
              {isNew ? 'Новый юзер' : `Редактировать: ${initial.username}`}
            </div>

            <TextField
              label="Логин (username)"
              value={form.username}
              onChange={(v) => set('username', v)}
              required={isNew}
              hint={isNew ? 'латиница, минимум 2 символа. Будет приведён к нижнему регистру.' : 'логин менять нельзя'}
            />
            {!isNew && (
              <div className="admin-field-hint" style={{ marginTop: -8 }}>
                (после создания логин менять нельзя — он используется для входа)
              </div>
            )}
            <TextField
              label="Имя"
              value={form.name}
              onChange={(v) => set('name', v)}
              placeholder="Макс, Саша, Админ…"
            />
            <SelectField
              label="Роль"
              value={form.role}
              onChange={(v) => set('role', v ?? 'reader')}
              options={ROLES}
              allowEmpty={false}
            />
            <TextField
              label={isNew ? 'Пароль' : 'Новый пароль (оставь пустым чтобы не менять)'}
              value={form.password}
              onChange={(v) => set('password', v)}
              required={isNew}
              placeholder={isNew ? 'минимум 4 символа' : '…'}
            />

            {error && <div className="login-error">{error}</div>}

            <div className="admin-form-actions">
              <button type="button" className="admin-btn" onClick={safeClose} disabled={saving}>Отмена</button>
              <button type="submit" className="login-submit" disabled={saving}>
                {saving ? 'Сохраняю…' : (isNew ? 'Создать' : 'Сохранить')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
