"""Per-user state: classic learning progress."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Classic, ClassicProgress, User

router = APIRouter(prefix="/api/me", tags=["me"])


@router.get("/progress", response_model=list[str])
def list_progress(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the slugs of classics the current user has marked learned."""
    rows = (
        db.query(Classic.slug)
        .join(ClassicProgress, ClassicProgress.classic_id == Classic.id)
        .filter(ClassicProgress.user_id == user.id)
        .all()
    )
    return [r.slug for r in rows]


def _resolve_classic(db: Session, slug: str) -> Classic:
    classic = db.query(Classic).filter(Classic.slug == slug).first()
    if not classic:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classic not found")
    return classic


@router.post("/progress/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def mark_learned(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    classic = _resolve_classic(db, slug)
    existing = (
        db.query(ClassicProgress)
        .filter(ClassicProgress.user_id == user.id, ClassicProgress.classic_id == classic.id)
        .first()
    )
    if not existing:
        db.add(ClassicProgress(user_id=user.id, classic_id=classic.id))
        db.commit()


@router.delete("/progress/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def unmark_learned(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    classic = _resolve_classic(db, slug)
    db.query(ClassicProgress).filter(
        ClassicProgress.user_id == user.id,
        ClassicProgress.classic_id == classic.id,
    ).delete()
    db.commit()
