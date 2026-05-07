import { useState, useEffect, useRef, useCallback } from 'react';
import { classics, classicFamilies } from '../data/classics';

export default function ProgressPanel({ learned, onClose, onOpenClassic }) {
  const [tab, setTab] = useState('learned');
  const sheetRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const onWrapperClick = useCallback((e) => {
    if (sheetRef.current && !sheetRef.current.contains(e.target)) onClose();
  }, [onClose]);

  const learnedList = classics.filter((c) => learned.has(c.id));
  const notLearnedList = classics.filter((c) => !learned.has(c.id));
  const pct = Math.round(learned.size / classics.length * 100);

  const familyStats = classicFamilies.map((f) => {
    const total = classics.filter((c) => c.family === f.key).length;
    const done = classics.filter((c) => c.family === f.key && learned.has(c.id)).length;
    const ratio = total ? done / total : 0;
    const level = ratio >= 0.8 ? 'good' : ratio >= 0.4 ? 'partial' : 'none';
    const levelLabel = ratio >= 0.8 ? 'Знаю хорошо' : ratio >= 0.4 ? 'Знаю частично' : 'Не изучено';
    return { ...f, total, done, ratio, level, levelLabel };
  });

  const displayList = tab === 'learned' ? learnedList : notLearnedList;

  return (
    <div className="sheet-wrapper open" onClick={onWrapperClick}>
      <div className="sheet-container">
        <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="sheet" ref={sheetRef} style={{ maxHeight: '85vh' }}>
          <div className="sheet-body">

            <div className="progress-panel-header">
              <div className="progress-panel-stat">
                <span className="progress-panel-num">{learned.size}</span>
                <span className="progress-panel-denom">/ {classics.length}</span>
              </div>
              <div className="progress-panel-pct">{pct}% выучено</div>
            </div>

            <div className="sheet-divider" />

            <div className="sheet-label" style={{ marginBottom: '.6rem' }}>По семействам</div>
            <div className="progress-families">
              {familyStats.map((f) => (
                <div key={f.key} className="progress-family-row">
                  <div className="progress-family-name" style={{ color: f.color }}>{f.label}</div>
                  <div className="progress-family-bar-wrap">
                    <div
                      className="progress-family-bar"
                      style={{ width: `${f.ratio * 100}%`, background: f.color }}
                    />
                  </div>
                  <div className={`progress-family-level progress-family-level--${f.level}`}>
                    {f.done}/{f.total}
                  </div>
                </div>
              ))}
            </div>

            <div className="sheet-divider" />

            <div className="progress-tabs">
              <button
                className={`progress-tab${tab === 'learned' ? ' active' : ''}`}
                onClick={() => setTab('learned')}
              >
                Знаю ({learnedList.length})
              </button>
              <button
                className={`progress-tab${tab === 'not' ? ' active' : ''}`}
                onClick={() => setTab('not')}
              >
                Не знаю ({notLearnedList.length})
              </button>
            </div>

            <div className="progress-list">
              {displayList.length === 0 && (
                <div className="empty-state-text" style={{ padding: '1.5rem 0', textAlign: 'center' }}>
                  {tab === 'learned' ? 'Ещё ничего не отмечено' : 'Все выучены!'}
                </div>
              )}
              {displayList.map((c) => (
                <button
                  key={c.id}
                  className="progress-list-item"
                  onClick={() => { onClose(); onOpenClassic(c); }}
                >
                  <span className="progress-list-name">{c.name}</span>
                  <span className="progress-list-family">{c.glass}</span>
                  <span className="progress-list-arrow">→</span>
                </button>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
