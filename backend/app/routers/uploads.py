"""Image uploads (editor/admin only).

Files land in $UPLOAD_DIR (default /app/uploads), are served back via
GET /static/img/<name> (static mount in main.py), and the endpoint
returns the public path the editor should save into the cocktail.img field.
"""
import os
import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.auth import require_editor

router = APIRouter(prefix="/api/admin/uploads", tags=["uploads"], dependencies=[Depends(require_editor)])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
ALLOWED_EXTS = {".webp", ".jpg", ".jpeg", ".png", ".avif"}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB

SAFE_BASENAME = re.compile(r"[^a-zA-Z0-9._-]+")


class UploadResponse(BaseModel):
    url: str       # public path to save into cocktail.img (e.g. "/static/img/xxx.webp")
    filename: str
    size: int


def _safe_filename(original: str) -> str:
    """Build a collision-resistant filename based on the original name + random suffix."""
    stem = Path(original).stem or "image"
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail=f"Допустимы только {sorted(ALLOWED_EXTS)}")
    safe_stem = SAFE_BASENAME.sub("-", stem)[:48].strip("-") or "image"
    suffix = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8]
    return f"{safe_stem}-{suffix}{ext}"


@router.post("/image", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Stream-friendly size check (UploadFile is a SpooledTemporaryFile)
    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Файл больше {MAX_BYTES // (1024 * 1024)} МБ")
    if len(contents) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")

    filename = _safe_filename(file.filename or "image")
    dest = UPLOAD_DIR / filename
    dest.write_bytes(contents)

    return UploadResponse(
        url=f"/static/img/{filename}",
        filename=filename,
        size=len(contents),
    )
