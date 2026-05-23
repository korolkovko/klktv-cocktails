import { useEffect, useRef, useCallback } from 'react';
import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';

function CaffeineBar({ level }) {
  return (
    <div className="zc-caffeine">
      <span className="zc-caffeine-label">кофеин</span>
      <div className="zc-caffeine-dots">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`zc-caffeine-dot${n <= level ? ' on' : ''}`} />
        ))}
      </div>
      <span className="zc-caffeine-value">{level}/3</span>
    </div>
  );
}

export default function ZCSheet({ item, onClose }) {
  const imgUrl = resolveImageUrl(item?.img);
  const bgColor = useImageColor(imgUrl);
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
            <div className="sheet-hero" style={{ background: bgColor || '#111' }}>
              <img src={imgUrl} alt={item.name} />
            </div>
          )}
          <div className="sheet-body">
            <div className={`zc-tag ${item.isAlcoholic ? 'zc-tag--alc' : 'zc-tag--non'}`}>
              Zero Culture · {item.isAlcoholic ? 'Алко' : 'Non Alc'}
            </div>
            <div className="sheet-name">{item.name}</div>
            {item.tagline && <div className="sheet-tagline">{item.tagline}</div>}

            <div className="sheet-meta">
              {item.price && <span className="sheet-meta-pill sheet-meta-pill--price">{item.price}</span>}
              {item.abv && <span className="sheet-meta-pill">{item.abv}</span>}
              {item.glass && <span className="sheet-meta-pill">{item.glass}</span>}
            </div>

            {!item.isAlcoholic && item.caffeineLevel != null && (
              <CaffeineBar level={item.caffeineLevel} />
            )}

            {!item.isAlcoholic && item.isCarbonated != null && (
              <div className={`zc-carbo${item.isCarbonated ? ' on' : ''}`}>
                <span className="zc-carbo-icon">{item.isCarbonated ? '◉' : '◯'}</span>
                <span>{item.isCarbonated ? 'Газированный' : 'Без газа'}</span>
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
}
