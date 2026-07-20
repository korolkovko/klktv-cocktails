import { useEffect, useRef, useCallback } from 'react';
import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';
import LearnedToggle from './LearnedToggle';

export default function BottomSheet({ cocktail, onClose }) {
  const imgUrl = resolveImageUrl(cocktail?.img);
  const bgColor = useImageColor(imgUrl);
  const sheetRef = useRef(null);

  // Lock body scroll
  useEffect(() => {
    if (!cocktail) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [cocktail]);

  // Esc to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click outside sheet to close
  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) {
      onClose();
    }
  }, [onClose]);

  if (!cocktail) return null;

  return (
    <div className="sheet-wrapper open" onClick={onWrapperClick}>
      <div className="sheet-container">
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef}>
          <div className="sheet-hero" style={{ background: bgColor || '#111' }}>
            {imgUrl && <img src={imgUrl} alt={cocktail.name} />}
          </div>
          <div className="sheet-body">
            <div className="sheet-name">{cocktail.name}</div>
            <div className="sheet-tagline">{cocktail.tagline}</div>

            {cocktail.meta && (
              <div className="sheet-meta">
                {cocktail.meta.map((m, i) => (
                  <span
                    key={i}
                    className={`sheet-meta-pill${i === 0 && m.includes('\u20BD') ? ' sheet-meta-pill--price' : ''}`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            )}

            <div className="sheet-flavors">
              {cocktail.flavors.map((f) => (
                <span key={f} className="sheet-flavor">{f}</span>
              ))}
            </div>

            {cocktail.details.length > 0 && (
              <>
                <div className="sheet-divider" />
                {cocktail.details.map((d, i) => (
                  <div key={i} className="sheet-section">
                    <div className="sheet-label">{d.label}</div>
                    <div className="sheet-text">{d.text}</div>
                  </div>
                ))}
              </>
            )}

            <LearnedToggle kind="menu" slug={cocktail.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
