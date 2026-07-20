from pathlib import Path

from app.media_seed import SEED_DIR, seed_media_into


def test_seed_dir_is_populated():
    # the baked media set must actually exist in the image
    assert SEED_DIR.is_dir()
    assert sum(1 for p in SEED_DIR.iterdir() if p.is_file()) > 0


def test_seed_copies_then_is_idempotent(tmp_path):
    dst = tmp_path / "uploads"
    n = seed_media_into(dst)
    assert n > 0
    files = sorted(p.name for p in dst.iterdir())
    assert files  # something landed
    # second run copies nothing (idempotent)
    assert seed_media_into(dst) == 0
    assert sorted(p.name for p in dst.iterdir()) == files


def test_seed_never_clobbers_existing(tmp_path):
    dst = tmp_path / "uploads"
    dst.mkdir()
    # a pre-existing file with the name of a real seed file must NOT be overwritten
    victim = next(p for p in SEED_DIR.iterdir() if p.is_file())
    (dst / victim.name).write_bytes(b"admin-uploaded-do-not-touch")
    seed_media_into(dst)
    assert (dst / victim.name).read_bytes() == b"admin-uploaded-do-not-touch"
