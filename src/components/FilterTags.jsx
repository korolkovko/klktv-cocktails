import { useRef, useEffect } from 'react';

export default function FilterTags({ filters, active, onSelect, label }) {
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [active]);

  return (
    <nav className="nav-tags">
      {label && <span className="nav-tags-label">{label}</span>}
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
