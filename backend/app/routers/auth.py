import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    set_auth_cookie,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
_WINDOW_S = 60
_MAX_ATTEMPTS = 5


def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = [t for t in _ATTEMPTS[ip] if now - t < _WINDOW_S]
    if len(hits) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts, try again later")
    hits.append(now)
    _ATTEMPTS[ip] = hits


@router.post("/login", response_model=UserResponse)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate_limit(request)
    user = db.query(User).filter(User.username == req.username.lower().strip()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )
    token = create_access_token(user.id)
    set_auth_cookie(response, token)
    return UserResponse(username=user.username, name=user.name, role=user.role)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    # Mutate and return the injected `response` (do not construct/return a new
    # Response here) — FastAPI only merges headers/cookies set on the injected
    # object when the handler doesn't return a fresh Response of its own;
    # returning a new one silently drops the delete-cookie Set-Cookie header.
    clear_auth_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return UserResponse(username=user.username, name=user.name, role=user.role)
