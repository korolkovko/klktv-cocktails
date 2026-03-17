import { useEffect, useRef, useCallback } from 'react';
import { useImageColor } from '../hooks/useImageColor';

export default function BottomSheet({ cocktail, onClose }) {
  const bgColor = useImageColor(cocktail?.img);
  const sheetRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);
  const draggingRef = useRef(false);

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

  // Swipe to close
  const onTouchStart = useCallback((e) => {
    startYRef.current = e.touches[0].clientY;
    currentYRef.current = e.touches[0].clientY;
    draggingRef.current = true;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!draggingRef.current) return;
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;
    if (diff > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${diff}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (sheetRef.current) sheetRef.current.style.transition = '';
    const diff = currentYRef.current - startYRef.current;
    if (diff > 100) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
  }, [onClose]);

  if (!cocktail) return null;

  return (
    <>
      <div className={`overlay ${cocktail ? 'open' : ''}`} onClick={onClose} />
      <div
        className={`sheet ${cocktail ? 'open' : ''}`}
        ref={sheetRef}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="sheet-handle-area" onTouchStart={onTouchStart}>
          <div className="sheet-handle" />
        </div>
        <div className="sheet-hero" style={{ background: bgColor || '#111' }}>
          <img src={cocktail.img} alt={cocktail.name} />
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
        </div>
      </div>
    </>
  );
}
