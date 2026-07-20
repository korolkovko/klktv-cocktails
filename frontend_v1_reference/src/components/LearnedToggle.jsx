import { useProgress } from '../data/useProgress';

/**
 * Generic "знаю/не знаю" toggle. Renders inside a sheet body.
 *   <LearnedToggle kind="menu" slug={cocktail.id} />
 */
export default function LearnedToggle({ kind, slug }) {
  const { learned, toggle } = useProgress(kind);
  const isLearned = learned.has(slug);
  return (
    <button
      className={`classic-sheet-learned${isLearned ? ' active' : ''}`}
      onClick={() => toggle(slug)}
    >
      {isLearned ? '✓ Знаю' : '○ Отметить как знакомый'}
    </button>
  );
}
