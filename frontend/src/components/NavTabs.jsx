export default function NavTabs({ active, onSelect }) {
  return (
    <div className="page-nav">
      <button
        className={`page-nav-tab${active === 'menu' ? ' active' : ''}`}
        onClick={() => onSelect('menu')}
      >
        Меню
      </button>
      <button
        className={`page-nav-tab${active === 'classics' ? ' active' : ''}`}
        onClick={() => onSelect('classics')}
      >
        Классика
      </button>
    </div>
  );
}
