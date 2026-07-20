"""Populate UPLOAD_DIR from the image set baked into the backend image (seed_media/).

The prod Railway volume mounted at UPLOAD_DIR starts empty, but the DB already
references these files at /static/img/<name>. `seed_media_into` copies each
baked file that isn't already on the volume — idempotent, and it never clobbers
an admin-uploaded file that already exists. Called from main.py's lifespan on
boot; also runnable standalone (`python -m app.media_seed`).
"""
import shutil
from pathlib import Path

SEED_DIR = Path(__file__).resolve().parent.parent / "seed_media"


def seed_media_into(upload_dir: Path) -> int:
    """Copy every seed_media file not already present in `upload_dir`.
    Returns the number of files copied. Idempotent; never overwrites."""
    if not SEED_DIR.is_dir():
        return 0
    upload_dir.mkdir(parents=True, exist_ok=True)
    copied = 0
    for src in SEED_DIR.iterdir():
        if not src.is_file():
            continue
        dst = upload_dir / src.name
        if not dst.exists():
            shutil.copy2(src, dst)
            copied += 1
    return copied


if __name__ == "__main__":
    import os

    d = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))
    print(f"seeded {seed_media_into(d)} media file(s) into {d}")
