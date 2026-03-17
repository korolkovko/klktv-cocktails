import { useRef, useEffect } from 'react';
import { filters } from '../data/cocktails';

export default function FilterTags({ active, onSelect }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [active]);

  return (
    <nav className="nav-tags">
      {filters.map((f) => (
        <button
          key={f.key}
          ref={f.key === active ? activeRef : null}
          className={`nav-tag${f.key === active ? ' active' : ''}`}
          onClick={() => onSelect(f.key)}
        >
          {f.label}
        </button>
      ))}
    </nav>
  );
}
