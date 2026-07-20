"""Team learning-progress overview.

Visible to EVERY authenticated user (not admin-only): the kit's "Прогресс
команды" view was scoped admin in the blueprint, but the owner wants the
whole team able to see it. Read-only aggregate over learning_progress +
users; no per-user state is mutated here.

Kinds are the four v2 sections (menu/classics/spirits/kitchen); the old
zero/zc kinds no longer exist (merged into menu). `totals` are the catalog
denominators so the frontend can compute per-section and overall %.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app import models as m
from app.schemas import TeamOut, TeamMemberOut

router = APIRouter(prefix="/api/team", tags=["team"], dependencies=[Depends(get_current_user)])

KINDS = ("menu", "classics", "spirits", "kitchen")


@router.get("", response_model=TeamOut)
def get_team(db: Session = Depends(get_db)):
    totals = {
        "menu": db.scalar(select(func.count()).select_from(m.Drink)),
        "classics": db.scalar(select(func.count()).select_from(m.Classic)),
        "spirits": db.scalar(select(func.count()).select_from(m.SpiritEntry)),
        "kitchen": db.scalar(select(func.count()).select_from(m.KitchenDish)),
    }

    # learned counts per (user, kind) and last activity per user — two small
    # grouped scans instead of N per-user queries.
    counts = db.execute(
        select(m.LearningProgress.user_id, m.LearningProgress.kind, func.count())
        .group_by(m.LearningProgress.user_id, m.LearningProgress.kind)
    ).all()
    last_active = dict(
        db.execute(
            select(m.LearningProgress.user_id, func.max(m.LearningProgress.learned_at))
            .group_by(m.LearningProgress.user_id)
        ).all()
    )
    by_user: dict[int, dict[str, int]] = {}
    for uid, kind, n in counts:
        if kind in KINDS:
            by_user.setdefault(uid, {})[kind] = n

    users = db.scalars(select(m.User).order_by(m.User.id)).all()
    members = [
        TeamMemberOut(
            username=u.username,
            name=u.name,
            role=u.role,
            learned={k: by_user.get(u.id, {}).get(k, 0) for k in KINDS},
            lastActiveAt=last_active.get(u.id),
        )
        for u in users
    ]
    return TeamOut(totals=totals, members=members)
