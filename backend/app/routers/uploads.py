"""Image uploads (editor/admin only).

Files land in $UPLOAD_DIR (default /app/uploads), are served back via
GET /static/img/<name> (static mount in main.py), and the endpoint
returns the public path the editor should save into the cocktail.img field.

Every upload is downscaled to `MAX_DIM` on the longer edge and re-encoded
so mobile clients don't have to download and decode multi-megabyte
originals. The batch-resize endpoint applies the same logic to files
already on the volume.
"""
import io
import os
import re
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from PIL import Image, ImageOps, UnidentifiedImageError

from app.auth import require_admin, require_editor

router = APIRouter(prefix="/api/admin/uploads", tags=["uploads"], dependencies=[Depends(require_editor)])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
ALLOWED_EXTS = {".webp", ".jpg", ".jpeg", ".png", ".avif"}
MAX_BYTES = 12 * 1024 * 1024   # accept large source uploads; we resize them
MAX_DIM = 1600                 # longer side, in px, after resize
JPEG_QUALITY = 82

SAFE_BASENAME = re.compile(r"[^a-zA-Z0-9._-]+")


class UploadResponse(BaseModel):
    url: str
    filename: str
    size: int


class ResizeReport(BaseModel):
    scanned: int
    resized: int
    saved_bytes: int
    errors: list[str]


def _safe_stem(original: str) -> str:
    stem = Path(original).stem or "image"
    safe = SAFE_BASENAME.sub("-", stem)[:48].strip("-") or "image"
    return safe


def _random_suffix() -> str:
    return secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8]


def _shrink_and_encode(raw: bytes, out_ext: str) -> bytes:
    """Open bytes with Pillow, downscale if needed, re-encode.
    Returns the new bytes. Ext is one of .jpg/.jpeg/.png/.webp/.avif."""
    try:
        img = Image.open(io.BytesIO(raw))
    except UnidentifiedImageError as e:
        raise HTTPException(400, detail=f"Не могу распознать формат: {e}")
    # Respect EXIF orientation (phones save landscape/portrait metadata)
    img = ImageOps.exif_transpose(img)

    # Drop alpha for JPEG (else Pillow crashes on save)
    if out_ext in (".jpg", ".jpeg") and img.mode not in ("RGB", "L"):
        bg = Image.new("RGB", img.size, (0, 0, 0))
        if img.mode == "RGBA":
            bg.paste(img, mask=img.split()[3])
        else:
            bg.paste(img.convert("RGB"))
        img = bg

    # Downscale in-place if either dim exceeds the cap
    w, h = img.size
    max_side = max(w, h)
    if max_side > MAX_DIM:
        scale = MAX_DIM / max_side
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    buf = io.BytesIO()
    if out_ext == ".webp":
        img.save(buf, format="WEBP", quality=JPEG_QUALITY, method=6)
    elif out_ext == ".png":
        img.save(buf, format="PNG", optimize=True)
    elif out_ext == ".avif":
        # Pillow may not always have AVIF support; fall back to WEBP if missing.
        try:
            img.save(buf, format="AVIF", quality=JPEG_QUALITY)
        except (KeyError, OSError, ValueError):
            img.save(buf, format="WEBP", quality=JPEG_QUALITY, method=6)
            out_ext = ".webp"
    else:  # .jpg / .jpeg
        img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)

    return buf.getvalue()


@router.post("/image", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Файл больше {MAX_BYTES // (1024 * 1024)} МБ")
    if len(raw) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Пустой файл")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                            detail=f"Допустимы только {sorted(ALLOWED_EXTS)}")

    shrunk = _shrink_and_encode(raw, ext)

    filename = f"{_safe_stem(file.filename or 'image')}-{_random_suffix()}{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(shrunk)

    return UploadResponse(
        url=f"/static/img/{filename}",
        filename=filename,
        size=len(shrunk),
    )


@router.post("/resize-existing", response_model=ResizeReport, dependencies=[Depends(require_admin)])
def resize_existing():
    """Walks $UPLOAD_DIR, resizes any file whose longer edge exceeds
    MAX_DIM. Overwrites in place. Admin-only (destructive on the volume)."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    scanned = 0
    resized = 0
    saved = 0
    errors: list[str] = []
    for p in sorted(UPLOAD_DIR.iterdir()):
        if not p.is_file():
            continue
        ext = p.suffix.lower()
        if ext not in ALLOWED_EXTS:
            continue
        scanned += 1
        try:
            raw = p.read_bytes()
            orig_size = len(raw)
            with Image.open(io.BytesIO(raw)) as probe:
                w, h = probe.size
            if max(w, h) <= MAX_DIM and orig_size < 400 * 1024:
                # Already small; skip
                continue
            new_bytes = _shrink_and_encode(raw, ext)
            if len(new_bytes) < orig_size:
                p.write_bytes(new_bytes)
                resized += 1
                saved += orig_size - len(new_bytes)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{p.name}: {e}")
    return ResizeReport(scanned=scanned, resized=resized, saved_bytes=saved, errors=errors)
