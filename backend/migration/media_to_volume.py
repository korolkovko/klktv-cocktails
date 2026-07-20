"""One-time, re-runnable: consolidate all media onto UPLOAD_DIR and rewrite
DB image paths to /static/img/<name>. Copies frontend/public/logos/*, any
files already sitting in the legacy dev upload dir (/tmp/klktv-uploads —
previously-downloaded kitchen photos), into UPLOAD_DIR, then updates
drinks.img/photo + kitchen img.
Idempotent: copy-if-absent, and only rewrites /logos/ -> /static/img/."""
import os, shutil, re
from pathlib import Path
from sqlalchemy import create_engine, text

REPO = Path(__file__).resolve().parents[2]
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", REPO / "backend/.uploads"))
LOGOS = REPO / "frontend/public/logos"
# Legacy dev upload dir used before UPLOAD_DIR was pinned to backend/.uploads —
# any kitchen photos an editor already uploaded during earlier dev sessions
# live here. Absent/empty is fine (fresh checkout, or already migrated).
LEGACY_UPLOAD_DIR = Path(os.environ.get("LEGACY_UPLOAD_DIR", "/tmp/klktv-uploads"))
IMAGE_EXTS = {".webp", ".jpg", ".jpeg", ".png", ".avif", ".gif"}


def _safe(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", name)


def _copy_if_absent(src_dir: Path) -> int:
    """Copy every image file in src_dir into UPLOAD_DIR unless a file of the
    same (sanitized) name already exists there. Returns the number of files
    copied. Names are run through `_safe()` — same as the logos loop — so no
    un-sanitized legacy filename ever lands at /static/img/<name>."""
    if not src_dir.is_dir():
        return 0
    copied = 0
    for p in sorted(src_dir.iterdir()):
        if not p.is_file() or p.suffix.lower() not in IMAGE_EXTS:
            continue
        dst = UPLOAD_DIR / _safe(p.name)
        if not dst.exists():
            shutil.copy2(p, dst)
            copied += 1
    return copied


def run(dest_url: str):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # 1) copy logo files into the volume (rename spaces etc. to safe names)
    copied = {}
    if LOGOS.is_dir():
        for p in LOGOS.iterdir():
            if p.is_file():
                dst_name = _safe(p.name)
                dst = UPLOAD_DIR / dst_name
                if not dst.exists():
                    shutil.copy2(p, dst)
                copied[f"/logos/{p.name}"] = f"/static/img/{dst_name}"

    # 2) copy any already-downloaded kitchen photos (or other media) sitting
    # in the legacy dev upload dir — idempotent, copy-if-absent; the DB's
    # kitchen `img` paths already point at /static/img/<name> and just need
    # the file itself to exist on the (new) volume.
    n_legacy = _copy_if_absent(LEGACY_UPLOAD_DIR)
    print(f"copied {n_legacy} legacy file(s) from {LEGACY_UPLOAD_DIR}")

    # 3) rewrite drinks.img (/logos/<f> -> /static/img/<safe f>)
    engine = create_engine(dest_url)
    with engine.begin() as c:
        rows = c.execute(text("SELECT id, img FROM drinks WHERE img LIKE '/logos/%'")).mappings().all()
        for r in rows:
            new = copied.get(r["img"], "/static/img/" + _safe(r["img"].split("/")[-1]))
            c.execute(text("UPDATE drinks SET img=:i WHERE id=:id"), {"i": new, "id": r["id"]})
        print(f"rewrote {len(rows)} drink logo paths")

        # same treatment for drinks.photo, in case any drink stores a
        # /logos/ path there too (schema allows it; harmless no-op otherwise).
        photo_rows = c.execute(text("SELECT id, photo FROM drinks WHERE photo LIKE '/logos/%'")).mappings().all()
        for r in photo_rows:
            new = copied.get(r["photo"], "/static/img/" + _safe(r["photo"].split("/")[-1]))
            c.execute(text("UPDATE drinks SET photo=:i WHERE id=:id"), {"i": new, "id": r["id"]})
        if photo_rows:
            print(f"rewrote {len(photo_rows)} drink photo paths")
    engine.dispose()


if __name__ == "__main__":
    run(os.environ["DEST_DATABASE_URL"])
