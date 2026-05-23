import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';

export default function SpiritCard({ entry, onClick }) {
  const imgUrl = resolveImageUrl(entry.img);
  const bgColor = useImageColor(imgUrl);
  const hasImg = !!imgUrl;

  return (
    <article className={`card kitchen-card${hasImg ? '' : ' kitchen-card--no-img'}`} onClick={() => onClick(entry)}>
      <div className="card-inner">
        {hasImg && (
          <div className="card-thumb" style={{ background: bgColor || '#111' }}>
            <img src={imgUrl} alt={entry.name} loading="lazy" />
          </div>
        )}
        <div className="card-content">
          <div className="card-name">{entry.name}</div>
          {entry.flavour && <div className="card-tagline">{entry.flavour}</div>}
          <div className="card-flavors">
            {entry.abv && <span className="flavor-tag flavor-tag--abv">{entry.abv}%</span>}
            {entry.price && <span className="flavor-tag flavor-tag--price">{entry.price}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
