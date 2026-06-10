import { useImageColor } from '../hooks/useImageColor';
import { resolveImageUrl } from '../auth/api';
import CardLearnedBtn from './CardLearnedBtn';

export default function KitchenCard({ dish, onClick }) {
  const imgUrl = resolveImageUrl(dish.img);
  const bgColor = useImageColor(imgUrl);
  const hasImg = !!imgUrl;

  return (
    <article className={`card kitchen-card${hasImg ? '' : ' kitchen-card--no-img'}`} onClick={() => onClick(dish)}>
      <CardLearnedBtn kind="kitchen" slug={dish.id} />
      <div className="card-inner">
        {hasImg && (
          <div className="card-thumb card-thumb--photo" style={{ background: bgColor || '#111' }}>
            <img src={imgUrl} alt={dish.name} loading="lazy" />
          </div>
        )}
        <div className="card-content">
          <div className="card-name">{dish.name}</div>
          {(dish.tagline || dish.description) && (
            <div className="card-tagline">{dish.tagline || dish.description}</div>
          )}
          <div className="card-flavors">
            {dish.price && <span className="flavor-tag flavor-tag--price">{dish.price}</span>}
            {dish.weight && <span className="flavor-tag">{dish.weight} г</span>}
            {dish.timing && <span className="flavor-tag flavor-tag--abv">{dish.timing} мин</span>}
          </div>
        </div>
      </div>
    </article>
  );
}
