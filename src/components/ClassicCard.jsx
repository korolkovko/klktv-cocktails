const FAMILY_COLORS = {
  sour: '#4e7a4e',
  daisy: '#7a8a2d',
  mary: '#8a2d2d',
  negroni: '#c0392b',
  martini: '#2c3e6b',
  manhattan: '#c07a30',
  highball: '#2d6b8a',
  spritz: '#d4781e',
  dessert: '#8a6b2d',
};

const SPIRIT_LABELS = {
  gin: 'Джин', vodka: 'Водка', rum: 'Ром',
  whiskey: 'Виски', brandy: 'Бренди',
  tequila: 'Текила', mezcal: 'Мескаль', other: 'Аперитив',
};

export default function ClassicCard({ classic, learned, onToggleLearned, onClick }) {
  const fc = FAMILY_COLORS[classic.family] || '#555';
  const spiritLabel = SPIRIT_LABELS[classic.spirits[0]] || null;

  const handleLearned = (e) => {
    e.stopPropagation();
    onToggleLearned(classic.id);
  };

  return (
    <article
      className="classic-card"
      style={{ '--fc': fc }}
      onClick={() => onClick(classic)}
    >
      {classic.year && (
        <div className="classic-card-year">{classic.year}</div>
      )}
      <div className="classic-card-body">
        <div className="classic-card-name">{classic.name}</div>
        {classic.origin && (
          <div className="classic-card-origin">{classic.origin}</div>
        )}
        <div className="classic-card-pills">
          {spiritLabel && (
            <span className="classic-pill classic-pill--spirit">{spiritLabel}</span>
          )}
          <span className="classic-pill classic-pill--glass">{classic.glass}</span>
        </div>
        <div className="classic-card-desc">
          {classic.descriptors.slice(0, 2).join(' · ')}
        </div>
      </div>
      <button
        className={`classic-learned-btn${learned ? ' learned' : ''}`}
        onClick={handleLearned}
        aria-label={learned ? 'Выучено' : 'Отметить как выученное'}
      >
        {learned ? '✓' : '○'}
      </button>
    </article>
  );
}
