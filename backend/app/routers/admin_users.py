"""User management — admin role only.

Safety rails:
- An admin cannot delete themselves.
- An admin cannot demote themselves from admin (lock-out protection).
- The last remaining admin cannot be deleted or demoted.
- Usernames are stored lower-cased; PATCH/POST normalise input.
"""
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth import hash_password, require_admin
from app.database import get_db
from app.models import User

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"], dependencies=[Depends(require_admin)])

Role = Literal["admin", "editor", "reader"]


class UserOut(BaseModel):
    id: int
    username: str
    name: str | None
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreateIn(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    password: str = Field(min_length=4, max_length=128)
    role: Role = "reader"
    name: str | None = None


class UserUpdateIn(BaseModel):
    role: Role | None = None
    name: str | None = None
    password: str | None = Field(default=None, min_length=4, max_length=128)


def _normalise_username(u: str) -> str:
    return u.strip().lower()


def _resolve(db: Session, identifier: str) -> User:
    """Look up user by either numeric id or username."""
    if identifier.isdigit():
        obj = db.get(User, int(identifier))
    else:
        obj = db.query(User).filter(User.username == _normalise_username(identifier)).first()
    if not obj:
        raise HTTPException(404, detail="User not found")
    return obj


def _admin_count(db: Session, exclude_id: int | None = None) -> int:
    q = db.query(User).filter(User.role == "admin")
    if exclude_id is not None:
        q = q.filter(User.id != exclude_id)
    return q.count()


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return (
        db.query(User)
        .order_by(User.role.desc(), User.username)
        .all()
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreateIn, db: Session = Depends(get_db)):
    username = _normalise_username(data.username)
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(409, detail="Username already taken")
    obj = User(
        username=username,
        password_hash=hash_password(data.password),
        role=data.role,
        name=data.name or None,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{identifier}", response_model=UserOut)
def update_user(
    identifier: str,
    data: UserUpdateIn,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
):
    obj = _resolve(db, identifier)

    # Self-demote lock-out: if I'm changing my OWN role away from admin, refuse
    if obj.id == me.id and data.role and data.role != "admin":
        raise HTTPException(400, detail="Нельзя снять с себя роль admin")

    # Last-admin protection: if obj is currently admin and we're demoting,
    # ensure at least one other admin remains.
    if obj.role == "admin" and data.role and data.role != "admin":
        if _admin_count(db, exclude_id=obj.id) == 0:
            raise HTTPException(400, detail="Нельзя снять роль с последнего админа")

    if data.role:
        obj.role = data.role
    if data.name is not None:
        obj.name = data.name or None
    if data.password:
        obj.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{identifier}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    identifier: str,
    db: Session = Depends(get_db),
    me: User = Depends(require_admin),
):
    obj = _resolve(db, identifier)
    if obj.id == me.id:
        raise HTTPException(400, detail="Нельзя удалить самого себя")
    if obj.role == "admin" and _admin_count(db, exclude_id=obj.id) == 0:
        raise HTTPException(400, detail="Нельзя удалить последнего админа")
    db.delete(obj)
    db.commit()
