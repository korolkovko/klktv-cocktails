import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';

const badgeStyles = {
  premium: 'badge badge--premium',
  onesip: 'badge badge--onesip',
  bottle: 'badge badge--bottle',
  hot: 'badge badge--hot',
};

const SPIRIT_LABELS = {
  gin: 'Джин',
  vodka: 'Водка',
  rum: 'Ром',
  bourbon: 'Бурбон',
  brandy: 'Бренди',
  mezcal: 'Мескаль',
};

export default function CocktailCard({ cocktail, onClick }) {
  const imgUrl = resolveImageUrl(cocktail.img);
  const bgColor = useImageColor(imgUrl);
  const spiritKey = cocktail.tags.find((t) => SPIRIT_LABELS[t]);
  const spiritLabel = spiritKey ? SPIRIT_LABELS[spiritKey] : null;

  return (
    <article className="card" onClick={() => onClick(cocktail)}>
      {cocktail.badge && (
        <span className={badgeStyles[cocktail.badge.type]}>
          {cocktail.badge.label}
        </span>
      )}
      <div className="card-inner">
        <div className="card-thumb" style={{ background: bgColor || '#111' }}>
          {imgUrl && <img src={imgUrl} alt={cocktail.name} loading="lazy" />}
        </div>
        <div className="card-content">
          <div className="card-name">{cocktail.name}</div>
          <div className="card-tagline">{cocktail.tagline}</div>
          {cocktail.meta && (
            <div className="card-meta">
              {cocktail.meta.map((m, i) => (
                <span
                  key={i}
                  className={`meta-pill${i === 0 && m.includes('\u20BD') ? ' meta-pill--price' : ''}`}
                >
                  {m}
                </span>
              ))}
            </div>
          )}
          <div className="card-flavors">
            {spiritLabel && (
              <span className="flavor-tag flavor-tag--spirit">{spiritLabel}</span>
            )}
            {cocktail.abv && (
              <span className="flavor-tag flavor-tag--abv">{cocktail.abv}</span>
            )}
            {cocktail.flavors.slice(0, 2).map((f) => (
              <span key={f} className="flavor-tag">{f}</span>
            ))}
            {cocktail.flavors.length > 2 && (
              <span className="flavor-tag flavor-tag--more">+{cocktail.flavors.length - 2}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
