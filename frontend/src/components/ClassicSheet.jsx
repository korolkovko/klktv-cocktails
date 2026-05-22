import { useEffect, useRef, useCallback } from 'react';
import { cocktails } from '../data/cocktails';

const FAMILY_COLORS = {
  sour: '#4e7a4e', daisy: '#7a8a2d', mary: '#8a2d2d',
  negroni: '#c0392b', martini: '#2c3e6b', manhattan: '#c07a30',
  highball: '#2d6b8a', spritz: '#d4781e', dessert: '#8a6b2d',
};

const FAMILY_LABELS = {
  sour: 'Sour', daisy: 'Daisy', mary: 'Mary',
  negroni: 'Negroni & Friends', martini: 'Martini / Martinez',
  manhattan: 'Manhattan', highball: 'Highball & Co.',
  spritz: 'Spritz & Bubbles', dessert: 'Dessert',
};

export default function ClassicSheet({ classic, learned, onToggleLearned, onClose, onOpenAuthorCocktail }) {
  const sheetRef = useRef(null);
  const fc = FAMILY_COLORS[classic?.family] || '#555';

  useEffect(() => {
    if (!classic) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [classic]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  }, [onClose]);

  if (!classic) return null;

  const relatedCocktails = (classic.relatedOurs || [])
    .map(id => cocktails.find(c => c.id === id))
    .filter(Boolean);

  return (
    <div className="sheet-wrapper open" onClick={onWrapperClick}>
      <div className="sheet-container">
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef}>
          <div className="sheet-body" style={{ '--fc': fc }}>

            <div className="classic-sheet-family" style={{ color: fc }}>
              {FAMILY_LABELS[classic.family]}
            </div>

            <div className="sheet-name">{classic.name}</div>

            <div className="classic-sheet-meta">
              {classic.year && <span className="classic-sheet-year">{classic.year}</span>}
              {classic.origin && <span className="classic-sheet-origin">{classic.origin}</span>}
            </div>

            <div className="sheet-flavors" style={{ marginTop: '.75rem' }}>
              {classic.descriptors.map((d) => (
                <span key={d} className="sheet-flavor">{d}</span>
              ))}
            </div>

            <div className="sheet-divider" />

            <div className="sheet-section">
              <div className="sheet-label">Состав</div>
              <div className="sheet-text">{classic.composition}</div>
            </div>

            <div className="classic-sheet-info">
              <div className="sheet-section">
                <div className="sheet-label">Бокал</div>
                <div className="sheet-text">{classic.glass}</div>
              </div>
              <div className="sheet-section">
                <div className="sheet-label">Гарниш</div>
                <div className="sheet-text">{classic.garnish}</div>
              </div>
            </div>

            <div className="sheet-section">
              <div className="sheet-label">История</div>
              <div className="sheet-text">{classic.history}</div>
            </div>

            <div className="sheet-section">
              <div className="sheet-label">Кому подходит</div>
              <div className="sheet-text">{classic.forWhom}</div>
            </div>

            {relatedCocktails.length > 0 && (
              <>
                <div className="sheet-divider" />
                <div className="sheet-section">
                  <div className="sheet-label">Наш ответ</div>
                  <div className="classic-related-list">
                    {relatedCocktails.map((c) => (
                      <button
                        key={c.id}
                        className="classic-related-btn"
                        onClick={() => { onClose(); onOpenAuthorCocktail(c); }}
                      >
                        {c.name} →
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              className={`classic-sheet-learned${learned ? ' active' : ''}`}
              onClick={() => onToggleLearned(classic.id)}
            >
              {learned ? '✓ Знаю' : '○ Отметить как выученное'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
