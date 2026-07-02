import { resolveImageUrl } from '../auth/api';
import CardLearnedBtn from './CardLearnedBtn';

export default function ZCCard({ item, onClick }) {
  const imgUrl = resolveImageUrl(item.img);
  return (
    <article className="card" onClick={() => onClick(item)}>
      <CardLearnedBtn kind="zc" slug={item.id} />
      <span className={`badge zc-badge ${item.isAlcoholic ? 'zc-badge--alc' : 'zc-badge--non'}`}>
        {item.isAlcoholic ? 'Алко' : 'Non Alc'}
      </span>
      <div className="card-inner">
        <div className="card-thumb card-thumb--photo" style={{ background: '#161616' }}>
          {imgUrl && <img src={imgUrl} alt={item.name} loading="lazy" decoding="async" />}
        </div>
        <div className="card-content">
          <div className="card-name">{item.name}</div>
          {item.tagline && <div className="card-tagline">{item.tagline}</div>}
          <div className="card-flavors">
            {item.price && <span className="flavor-tag flavor-tag--price">{item.price}</span>}
            {item.abv && <span className="flavor-tag flavor-tag--abv">{item.abv}</span>}
            {item.glass && <span className="flavor-tag">{item.glass}</span>}
            {!item.isAlcoholic && item.caffeineLevel != null && (
              <span className="flavor-tag flavor-tag--caffeine">
                кофеин {item.caffeineLevel}/3
              </span>
            )}
            {!item.isAlcoholic && item.isCarbonated === true && (
              <span className="flavor-tag flavor-tag--carbo">газ</span>
            )}
            {!item.isAlcoholic && item.isCarbonated === false && (
              <span className="flavor-tag flavor-tag--still">без газа</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
