import { useEffect, useState } from 'react';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import UserEditor from './UserEditor';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await api.get('/api/admin/users');
      setUsers(list);
    } catch (e) {
      alert(`Не удалось загрузить юзеров: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDelete = async (u) => {
    if (!confirm(`Удалить юзера «${u.username}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/users/${encodeURIComponent(u.username)}`);
      await load();
    } catch (e) {
      alert(`Не удалось удалить: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-list-head">
        <h2 className="admin-list-title">Пользователи</h2>
        <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
          + Новый юзер
        </button>
      </div>
      {loading ? (
        <div className="admin-soon">Загружаю…</div>
      ) : (
        <div className="admin-list">
          {users.map((u) => (
            <div key={u.id} className="admin-list-row">
              <div className="admin-list-row-main">
                <div className="admin-list-row-name">
                  <span className={`admin-role admin-role--${u.role}`}>{u.role}</span>
                  {u.name || u.username}
                </div>
                <div className="admin-list-row-sub">
                  <span>@{u.username}</span>
                  {u.id === currentUser?.id && <span>· это вы</span>}
                </div>
              </div>
              <div className="admin-list-row-actions">
                <button className="admin-btn" onClick={() => setEditing(u)} disabled={busy}>Изменить</button>
                <button
                  className="admin-btn admin-btn--danger"
                  onClick={() => onDelete(u)}
                  disabled={busy || u.id === currentUser?.id}
                  title={u.id === currentUser?.id ? 'Нельзя удалить себя' : 'Удалить'}
                >Удалить</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <UserEditor
          initial={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={load}
        />
      )}
    </>
  );
}
