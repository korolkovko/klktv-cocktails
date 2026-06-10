import { useEffect, useRef, useCallback } from 'react';
import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';
import LearnedToggle from './LearnedToggle';

export default function KitchenSheet({ dish, onClose }) {
  const imgUrl = resolveImageUrl(dish?.img);
  const bgColor = useImageColor(imgUrl);
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!dish) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [dish]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  }, [onClose]);

  if (!dish) return null;

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
              <img src={imgUrl} alt={dish.name} />
            </div>
          )}
          <div className="sheet-body">
            <div className="sheet-name">{dish.name}</div>
            {dish.tagline && <div className="sheet-tagline">{dish.tagline}</div>}

            <div className="sheet-meta">
              {dish.price && <span className="sheet-meta-pill sheet-meta-pill--price">{dish.price}</span>}
              {dish.weight && <span className="sheet-meta-pill">{dish.weight} г</span>}
              {dish.timing && <span className="sheet-meta-pill">{dish.timing} мин</span>}
            </div>

            {dish.description && (
              <>
                <div className="sheet-divider" />
                <div className="sheet-section">
                  <div className="sheet-label">Состав</div>
                  <div className="sheet-text">{dish.description}</div>
                </div>
              </>
            )}

            {dish.serving && (
              <div className="sheet-section">
                <div className="sheet-label">Сервировка</div>
                <div className="sheet-text">{dish.serving}</div>
              </div>
            )}

            {dish.interestingFacts && (
              <div className="sheet-section">
                <div className="sheet-label">Интересные факты</div>
                <div className="sheet-text">{dish.interestingFacts}</div>
              </div>
            )}

            {dish.nutrition && (
              <div className="sheet-section">
                <div className="sheet-label">Пищевая ценность</div>
                <div className="sheet-text" style={{ whiteSpace: 'pre-wrap', fontSize: '.85rem' }}>
                  {dish.nutrition}
                </div>
              </div>
            )}

            <LearnedToggle kind="kitchen" slug={dish.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
