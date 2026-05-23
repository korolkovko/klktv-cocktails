"""Per-user state: learning progress across all content kinds.

Slug-based polymorphic: one row = (user_id, kind, slug). Backward-compat
with the old classics-only endpoints is preserved at the URL level.
"""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import (
    Classic, Cocktail, KitchenDish, LearningProgress, SpiritEntry, User, ZCDrink, ZeroCocktail,
)

router = APIRouter(prefix="/api/me", tags=["me"])


# Allowed kinds → mapped to (Model, slug-attribute) for existence checks.
KIND_MODELS = {
    "menu":     Cocktail,
    "classics": Classic,
    "kitchen":  KitchenDish,
    "zero":     ZeroCocktail,
    "zc":       ZCDrink,
    "spirits":  SpiritEntry,
}


def _validate_kind(kind: str) -> None:
    if kind not in KIND_MODELS:
        raise HTTPException(status_code=400, detail=f"Unknown kind {kind!r}")


def _exists(db: Session, kind: str, slug: str) -> bool:
    Model = KIND_MODELS[kind]
    return db.query(Model).filter(Model.slug == slug).first() is not None


# ── Modern API (per-kind progress) ─────────────────────────

@router.get("/progress", response_model=dict[str, list[str]])
def list_progress(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a dict of slugs grouped by kind:
       {classics: [...], menu: [...], kitchen: [...], zero: [...], zc: [...]}.
    Empty kinds are still present (empty list)."""
    rows = (
        db.query(LearningProgress.kind, LearningProgress.slug)
        .filter(LearningProgress.user_id == user.id)
        .all()
    )
    out: dict[str, list[str]] = {k: [] for k in KIND_MODELS.keys()}
    for kind, slug in rows:
        out.setdefault(kind, []).append(slug)
    return out


@router.post("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def mark_learned(
    kind: str, slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_kind(kind)
    if not _exists(db, kind, slug):
        raise HTTPException(status_code=404, detail=f"{kind}/{slug} not found")
    existing = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.user_id == user.id,
            LearningProgress.kind == kind,
            LearningProgress.slug == slug,
        )
        .first()
    )
    if not existing:
        db.add(LearningProgress(user_id=user.id, kind=kind, slug=slug))
        db.commit()


@router.delete("/progress/{kind}/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def unmark_learned(
    kind: str, slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_kind(kind)
    db.query(LearningProgress).filter(
        LearningProgress.user_id == user.id,
        LearningProgress.kind == kind,
        LearningProgress.slug == slug,
    ).delete()
    db.commit()


# ── Legacy classics-only endpoints (kept for backward compat) ──

@router.post("/progress/{slug}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def mark_learned_legacy(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return mark_learned("classics", slug, user, db)


@router.delete("/progress/{slug}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def unmark_learned_legacy(
    slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return unmark_learned("classics", slug, user, db)
