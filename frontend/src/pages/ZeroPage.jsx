import { useState } from 'react';
import { useContent } from '../data/ContentContext';
import ZeroCard from '../components/ZeroCard';
import ZeroSheet from '../components/ZeroSheet';

export default function ZeroPage() {
  const { zeroCocktails } = useContent();
  const [selected, setSelected] = useState(null);

  return (
    <>
      <section>
        <div className="section-header">
          <h2>Без алкоголя, но всё ещё интересно</h2>
        </div>
        <div className="cocktail-list">
          {zeroCocktails.map((c) => (
            <ZeroCard key={c.id} item={c} onClick={setSelected} />
          ))}
        </div>
        {zeroCocktails.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">:/</div>
            <div className="empty-state-text">Пока пусто. Спросите бармена.</div>
          </div>
        )}
      </section>
      <ZeroSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
