import { useEffect, useRef, useCallback } from 'react';
import { resolveImageUrl } from '../auth/api';
import LearnedToggle from './LearnedToggle';

export default function ZeroSheet({ item, onClose }) {
  const imgUrl = resolveImageUrl(item?.img);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!item) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [item]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="sheet-wrapper open" onClick={onWrapperClick}>
      <div className="sheet-container">
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef}>
          {imgUrl && (
            <div className="sheet-hero" style={{ background: '#161616' }}>
              <img src={imgUrl} alt={item.name} decoding="async" />
            </div>
          )}
          <div className="sheet-body">
            <div className="sheet-name">{item.name}</div>
            {item.tagline && <div className="sheet-tagline">{item.tagline}</div>}

            <div className="sheet-meta">
              {item.price && <span className="sheet-meta-pill sheet-meta-pill--price">{item.price}</span>}
              <span className="sheet-meta-pill">{item.abv || 'Non Alc'}</span>
              {item.glass && <span className="sheet-meta-pill">{item.glass}</span>}
            </div>

            {item.ingredients && item.ingredients.length > 0 && (
              <>
                <div className="sheet-divider" />
                <div className="sheet-section">
                  <div className="sheet-label">В составе</div>
                  <ul className="sheet-list">
                    {item.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {item.details && item.details.length > 0 && (
              <>
                <div className="sheet-divider" />
                {item.details.map((d, i) => (
                  <div key={i} className="sheet-section">
                    <div className="sheet-label">{d.label}</div>
                    <div className="sheet-text">{d.text}</div>
                  </div>
                ))}
              </>
            )}

            <LearnedToggle kind="zero" slug={item.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
