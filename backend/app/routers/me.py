from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app import models as m

router = APIRouter(prefix="/api/me", tags=["me"])

KIND_MODELS = {"menu": m.Drink, "classics": m.Classic, "kitchen": m.KitchenDish, "spirits": m.SpiritEntry}


@router.get("/progress", response_model=dict[str, list[str]])
def get_progress(user=Depends(get_current_user), db: Session = Depends(get_db)):
    out = {k: [] for k in KIND_MODELS}
    rows = db.scalars(select(m.LearningProgress).where(m.LearningProgress.user_id == user.id)).all()
    for r in rows:
        if r.kind in out:
            out[r.kind].append(r.slug)
    return out


def _check(kind: str, slug: str, db: Session):
    model = KIND_MODELS.get(kind)
    if model is None:
        raise HTTPException(status_code=400, detail="Unknown kind")
    if db.scalar(select(model).where(model.slug == slug)) is None:
        raise HTTPException(status_code=404, detail="Unknown slug")


@router.post("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def mark(kind: str, slug: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    _check(kind, slug, db)
    stmt = insert(m.LearningProgress).values(user_id=user.id, kind=kind, slug=slug)
    stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "kind", "slug"])
    db.execute(stmt); db.commit()


@router.delete("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def unmark(kind: str, slug: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(m.LearningProgress).filter_by(user_id=user.id, kind=kind, slug=slug).delete()
    db.commit()
