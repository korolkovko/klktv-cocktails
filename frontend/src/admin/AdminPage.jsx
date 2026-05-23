import { useEffect, useMemo, useState } from 'react';
import { api } from '../auth/api';
import { useAuth } from '../auth/AuthContext';
import { useContent } from '../data/ContentContext';
import CocktailEditor from './CocktailEditor';
import ClassicEditor from './ClassicEditor';
import FamilyEditor from './FamilyEditor';
import UserEditor from './UserEditor';

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const { cocktails, classics, families, reload } = useContent();
  const isAdmin = currentUser?.role === 'admin';
  const [tab, setTab] = useState('cocktails');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Load users list lazily when admin opens the Users tab
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const list = await api.get('/api/admin/users');
      setUsers(list);
    } catch (e) {
      alert(`Не удалось загрузить юзеров: ${e.message}`);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'users' && isAdmin) loadUsers();
  }, [tab, isAdmin]);
  const [editing, setEditing] = useState(null);   // current entity being edited
  const [creating, setCreating] = useState(false); // bool — show "new" editor
  const [busy, setBusy] = useState(false);

  // What entity is the editor working on (matches `tab` when creating)
  const editorEntity = editing
    ? (editing._kind /* tagged on open */ || tab)
    : (creating ? tab : null);

  const sortedCocktails = useMemo(
    () => [...cocktails].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [cocktails]
  );
  const sortedClassics = useMemo(
    () => [...classics].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [classics]
  );
  const sortedFamilies = useMemo(
    () => [...families].sort((a, b) => a.label.localeCompare(b.label, 'ru')),
    [families]
  );

  const closeEditor = () => { setEditing(null); setCreating(false); };

  const onDelete = async (kind, identifier, displayName) => {
    if (!confirm(`Удалить «${displayName}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/${kind}/${encodeURIComponent(identifier)}`);
      await reload();
    } catch (e) {
      alert(`Не удалось удалить: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteUser = async (u) => {
    if (!confirm(`Удалить юзера «${u.username}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/users/${encodeURIComponent(u.username)}`);
      await loadUsers();
    } catch (e) {
      alert(`Не удалось удалить: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="admin-subtabs">
        <button
          className={`admin-subtab${tab === 'cocktails' ? ' active' : ''}`}
          onClick={() => setTab('cocktails')}
        >
          Меню · {cocktails.length}
        </button>
        <button
          className={`admin-subtab${tab === 'classics' ? ' active' : ''}`}
          onClick={() => setTab('classics')}
        >
          Классика · {classics.length}
        </button>
        <button
          className={`admin-subtab${tab === 'families' ? ' active' : ''}`}
          onClick={() => setTab('families')}
        >
          Семейства · {families.length}
        </button>
        {isAdmin && (
          <button
            className={`admin-subtab${tab === 'users' ? ' active' : ''}`}
            onClick={() => setTab('users')}
          >
            Юзеры{users.length ? ` · ${users.length}` : ''}
          </button>
        )}
      </div>

      {tab === 'cocktails' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Авторские коктейли</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новый коктейль
            </button>
          </div>
          <div className="admin-list">
            {sortedCocktails.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">{c.name}</div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    {c.abv && <span>· {c.abv}</span>}
                    {c.glass && <span>· {c.glass}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'cocktails' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('cocktails', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'classics' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Классические коктейли</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новая классика
            </button>
          </div>
          <div className="admin-list">
            {sortedClassics.map((c) => (
              <div key={c.id} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">{c.name}</div>
                  <div className="admin-list-row-sub">
                    <span>{c.id}</span>
                    <span>· {c.family}</span>
                    {c.year && <span>· {c.year}</span>}
                    {c.origin && <span>· {c.origin}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...c, _kind: 'classics' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('classics', c.id, c.name)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'families' && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Семейства классики</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новое семейство
            </button>
          </div>
          <div className="admin-list">
            {sortedFamilies.map((f) => (
              <div key={f.key} className="admin-list-row">
                <div className="admin-list-row-main">
                  <div className="admin-list-row-name">
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: f.color || '#555',
                        marginRight: 8,
                        verticalAlign: 'middle',
                      }}
                    />
                    {f.label}
                  </div>
                  <div className="admin-list-row-sub">
                    <span>{f.key}</span>
                    {f.sub && <span>· {f.sub}</span>}
                  </div>
                </div>
                <div className="admin-list-row-actions">
                  <button className="admin-btn" onClick={() => setEditing({ ...f, _kind: 'families' })} disabled={busy}>Изменить</button>
                  <button className="admin-btn admin-btn--danger" onClick={() => onDelete('families', f.key, f.label)} disabled={busy}>Удалить</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'users' && isAdmin && (
        <section>
          <div className="admin-list-head">
            <h2 className="admin-list-title">Пользователи</h2>
            <button className="login-submit admin-add-cta" onClick={() => setCreating(true)}>
              + Новый юзер
            </button>
          </div>
          {usersLoading ? (
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
                    <button className="admin-btn" onClick={() => setEditing({ ...u, _kind: 'users' })} disabled={busy}>Изменить</button>
                    <button
                      className="admin-btn admin-btn--danger"
                      onClick={() => onDeleteUser(u)}
                      disabled={busy || u.id === currentUser?.id}
                      title={u.id === currentUser?.id ? 'Нельзя удалить себя' : 'Удалить'}
                    >Удалить</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {editorEntity === 'cocktails' && (editing || creating) && (
        <CocktailEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'classics' && (editing || creating) && (
        <ClassicEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'families' && (editing || creating) && (
        <FamilyEditor initial={editing} onClose={closeEditor} onSaved={reload} />
      )}
      {editorEntity === 'users' && (editing || creating) && (
        <UserEditor initial={editing} onClose={closeEditor} onSaved={loadUsers} />
      )}
    </>
  );
}
