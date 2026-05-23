import { useEffect, useState } from 'react';

/**
 * Burger menu: top-left icon that opens a left drawer with navigation.
 *   items = [{key, label}]
 * Renders only the public categories (no admin links — those live in the footer).
 */
export default function BurgerMenu({ items, active, onSelect }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeItem = items.find((i) => i.key === active);

  return (
    <>
      <button
        className="burger-btn"
        onClick={() => setOpen(true)}
        aria-label="Меню"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <span className="burger-current">{activeItem?.label || 'Меню'}</span>
      </button>

      {open && (
        <div className="burger-overlay" onClick={() => setOpen(false)}>
          <nav className="burger-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="burger-drawer-head">
              <div className="burger-brand">Kollektiv</div>
              <button
                className="burger-close"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="burger-list">
              {items.map((it) => (
                <button
                  key={it.key}
                  className={`burger-item${it.key === active ? ' active' : ''}`}
                  onClick={() => { onSelect(it.key); setOpen(false); }}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
