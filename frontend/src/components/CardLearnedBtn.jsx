import { useProgress } from '../data/useProgress';

/**
 * Floating ○/✓ pill on a card. Same visual language as ClassicCard's
 * learned button. Click is contained — doesn't open the sheet.
 *   <CardLearnedBtn kind="menu" slug={cocktail.id} />
 */
export default function CardLearnedBtn({ kind, slug }) {
  const { learned, toggle } = useProgress(kind);
  const isLearned = learned.has(slug);
  const handle = (e) => {
    e.stopPropagation();
    toggle(slug);
  };
  return (
    <button
      className={`card-learned-btn${isLearned ? ' learned' : ''}`}
      onClick={handle}
      aria-label={isLearned ? 'Снять отметку' : 'Отметить как знакомое'}
      title={isLearned ? 'Знаю' : 'Отметить'}
    >
      {isLearned ? '✓' : '○'}
    </button>
  );
}
