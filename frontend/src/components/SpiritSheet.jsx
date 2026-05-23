import { useEffect, useRef, useCallback } from 'react';
import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';
import LearnedToggle from './LearnedToggle';

export default function SpiritSheet({ entry, onClose }) {
  const imgUrl = resolveImageUrl(entry?.img);
  const bgColor = useImageColor(imgUrl);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!entry) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [entry]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  }, [onClose]);

  if (!entry) return null;

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
            <div className="sheet-hero" style={{ background: bgColor || '#111' }}>
              <img src={imgUrl} alt={entry.name} />
            </div>
          )}
          <div className="sheet-body">
            <div className="sheet-name">{entry.name}</div>

            <div className="sheet-meta">
              {entry.abv && <span className="sheet-meta-pill">{entry.abv}%</span>}
              {entry.price && <span className="sheet-meta-pill sheet-meta-pill--price">{entry.price}</span>}
            </div>

            {entry.flavour && (
              <>
                <div className="sheet-divider" />
                <div className="sheet-section">
                  <div className="sheet-label">Вкус</div>
                  <div className="sheet-text">{entry.flavour}</div>
                </div>
              </>
            )}

            {entry.brand_country && (
              <div className="sheet-section">
                <div className="sheet-label">Бренд / Страна</div>
                <div className="sheet-text" style={{ whiteSpace: 'pre-wrap' }}>{entry.brand_country}</div>
              </div>
            )}

            {entry.features && (
              <div className="sheet-section">
                <div className="sheet-label">Особенности</div>
                <div className="sheet-text">{entry.features}</div>
              </div>
            )}

            {entry.cocktail_pairings && (
              <div className="sheet-section">
                <div className="sheet-label">В коктейлях</div>
                <div className="sheet-text" style={{ whiteSpace: 'pre-wrap' }}>{entry.cocktail_pairings}</div>
              </div>
            )}

            {entry.fact && (
              <div className="sheet-section">
                <div className="sheet-label">Занимательный факт</div>
                <div className="sheet-text">{entry.fact}</div>
              </div>
            )}

            <LearnedToggle kind="spirits" slug={entry.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
