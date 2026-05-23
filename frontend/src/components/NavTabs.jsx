import { useAuth } from '../auth/AuthContext';

export default function NavTabs({ active, onSelect }) {
  const { user } = useAuth();
  const canEdit = user && (user.role === 'admin' || user.role === 'editor');
  return (
    <div className="page-nav">
      <button
        className={`page-nav-tab${active === 'menu' ? ' active' : ''}`}
        onClick={() => onSelect('menu')}
      >
        Меню
      </button>
      <button
        className={`page-nav-tab${active === 'classics' ? ' active' : ''}`}
        onClick={() => onSelect('classics')}
      >
        Классика
      </button>
      {canEdit && (
        <button
          className={`page-nav-tab${active === 'admin' ? ' active' : ''}`}
          onClick={() => onSelect('admin')}
        >
          Админка
        </button>
      )}
    </div>
  );
}
