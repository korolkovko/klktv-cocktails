import importlib
import pytest


def test_missing_secret_key_fails_fast(monkeypatch):
    import app.config as c
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql://x/y")
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        importlib.reload(c)


def test_missing_database_url_fails_fast(monkeypatch):
    import app.config as c
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        importlib.reload(c)
