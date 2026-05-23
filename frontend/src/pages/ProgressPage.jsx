import { useMemo } from 'react';
import { useContent } from '../data/ContentContext';
import { useProgress } from '../data/useProgress';

// Maps the polymorphic `kind` to the user-facing label + the source list
// from ContentContext + the page key used when "open category" is clicked.
const KIND_CONFIG = [
  { kind: 'menu',     label: 'Меню',         source: 'cocktails' },
  { kind: 'classics', label: 'Классика',     source: 'classics' },
  { kind: 'kitchen',  label: 'Кухня',        source: 'kitchenDishes' },
  { kind: 'zero',     label: 'Безалко',      source: 'zeroCocktails' },
  { kind: 'zc',       label: 'Zero Culture', source: 'zcDrinks' },
];

export default function ProgressPage({ onOpenCategory }) {
  const content = useContent();
  const { byKind } = useProgress();

  const stats = useMemo(() => {
    return KIND_CONFIG
      .map(({ kind, label, source }) => {
        const all = content[source] || [];
        const learnedSet = byKind[kind] || new Set();
        // Intersect with actual content (in case slugs in DB became stale)
        const knownSlugs = new Set(all.map((x) => x.id));
        const learned = [...learnedSet].filter((s) => knownSlugs.has(s));
        const pct = all.length ? Math.round(learned.length * 100 / all.length) : 0;
        return { kind, label, source, total: all.length, learnedCount: learned.length, learnedSlugs: learned, all, pct };
      })
      .filter((s) => s.total > 0);
  }, [content, byKind]);

  const totalAll = stats.reduce((a, b) => a + b.total, 0);
  const totalLearned = stats.reduce((a, b) => a + b.learnedCount, 0);
  const totalPct = totalAll ? Math.round(totalLearned * 100 / totalAll) : 0;

  return (
    <>
      <section style={{ padding: '0 1.25rem' }}>
        <div className="section-header" style={{ paddingLeft: 0 }}>
          <h2>Прогресс изучения</h2>
          <p className="section-sub">
            Изучено {totalLearned} из {totalAll} позиций — {totalPct}%
          </p>
        </div>

        <div className="progress-overall">
          <div className="progress-overall-track">
            <div className="progress-overall-fill" style={{ width: `${totalPct}%` }} />
          </div>
        </div>
      </section>

      <section style={{ padding: '0 1.25rem' }}>
        <div className="progress-cards">
          {stats.map((s) => (
            <button
              key={s.kind}
              className="progress-card"
              onClick={() => onOpenCategory?.(s.kind)}
            >
              <div className="progress-card-head">
                <span className="progress-card-label">{s.label}</span>
                <span className="progress-card-count">{s.learnedCount} / {s.total}</span>
              </div>
              <div className="progress-card-track">
                <div className="progress-card-fill" style={{ width: `${s.pct}%` }} />
              </div>
              <div className="progress-card-pct">{s.pct}%</div>
            </button>
          ))}
        </div>

        {stats.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">:/</div>
            <div className="empty-state-text">Пока нет контента для отслеживания</div>
          </div>
        )}
      </section>

      {stats.map((s) => (
        s.learnedCount > 0 && (
          <section key={s.kind} style={{ padding: '0 1.25rem', marginTop: '1.5rem' }}>
            <div className="progress-list-title">{s.label} · знаю</div>
            <div className="progress-list-compact">
              {s.all.filter((x) => s.learnedSlugs.includes(x.id)).map((item) => (
                <div key={item.id} className="progress-list-compact-item">
                  {item.name}
                </div>
              ))}
            </div>
          </section>
        )
      ))}
    </>
  );
}
