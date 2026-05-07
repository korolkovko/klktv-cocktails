const FAMILIES = [
  { key: 'sour', label: 'Sour', sub: 'Кислые — фундамент миксологии' },
  { key: 'negroni', label: 'Negroni & Friends', sub: 'Горько-сладкие аперитивы' },
  { key: 'martini', label: 'Martini / Martinez', sub: 'Элегантные и сухие' },
  { key: 'manhattan', label: 'Manhattan', sub: 'Виски + вермут + биттер' },
  { key: 'highball', label: 'Highball & Co.', sub: 'Долгие и освежающие' },
  { key: 'spritz', label: 'Spritz & Bubbles', sub: 'Игристые аперитивы' },
  { key: 'dessert', label: 'Dessert', sub: 'Сладкое после ужина' },
];

export default function ClassicsPage() {
  return (
    <div className="classics-page">
      <div className="classics-families">
        {FAMILIES.map((f) => (
          <div key={f.key} className="family-chip">
            <span className="family-chip-label">{f.label}</span>
            <span className="family-chip-sub">{f.sub}</span>
          </div>
        ))}
      </div>

      <div className="classics-empty">
        <div className="empty-state-icon">📚</div>
        <div className="empty-state-text">Каталог классики — скоро</div>
      </div>
    </div>
  );
}
