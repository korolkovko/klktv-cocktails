import { useAuth } from '../auth/AuthContext';

/**
 * Site footer. Public part is the brand line; the rest depends on role:
 *   - editor/admin  → "Управление контентом"
 *   - admin only   → "Юзеры"
 *   - all logged-in → "Выйти"  (with current user's name as label)
 */
export default function Footer({ onOpenAdmin, onOpenUsers, onOpenProgress }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const canEdit  = user.role === 'admin' || user.role === 'editor';
  const isAdmin  = user.role === 'admin';

  return (
    <footer className="footer">
      <div className="footer-brand">
        <div className="logo-text">Kollektiv</div>
        <p>Коктейльная карта</p>
      </div>

      <div className="footer-actions">
        <button className="footer-link" onClick={onOpenProgress}>
          Прогресс изучения
        </button>
        {canEdit && (
          <button className="footer-link" onClick={onOpenAdmin}>
            Управление контентом
          </button>
        )}
        {isAdmin && (
          <button className="footer-link" onClick={onOpenUsers}>
            Юзеры
          </button>
        )}
        <button className="footer-link footer-link--user" onClick={logout}>
          <span className="footer-link-name">{user.name || user.username}</span>
          <span className="footer-link-action">Выйти ↪</span>
        </button>
      </div>
    </footer>
  );
}
