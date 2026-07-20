import { resolveImageUrl } from '../auth/api';
import CardLearnedBtn from './CardLearnedBtn';

export default function ZeroCard({ item, onClick }) {
  const imgUrl = resolveImageUrl(item.img);
  return (
    <article className="card" onClick={() => onClick(item)}>
      <CardLearnedBtn kind="zero" slug={item.id} />
      <div className="card-inner">
        <div className="card-thumb card-thumb--photo" style={{ background: '#161616' }}>
          {imgUrl && <img src={imgUrl} alt={item.name} loading="lazy" decoding="async" />}
        </div>
        <div className="card-content">
          <div className="card-name">{item.name}</div>
          {item.tagline && <div className="card-tagline">{item.tagline}</div>}
          <div className="card-flavors">
            {item.price && <span className="flavor-tag flavor-tag--price">{item.price}</span>}
            <span className="flavor-tag flavor-tag--abv">{item.abv || 'Non Alc'}</span>
            {item.glass && <span className="flavor-tag">{item.glass}</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
