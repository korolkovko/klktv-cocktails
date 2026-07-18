import os


def require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"{name} is required and must be set (no default in v2).")
    return val


SECRET_KEY = require_env("SECRET_KEY")
DATABASE_URL = require_env("DATABASE_URL")

DEBUG = os.environ.get("DEBUG", "false").lower() == "true"

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

COOKIE_NAME = "klktv_session"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none")  # "none" for cross-origin prod, "lax" for local
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN") or None

ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_HOURS", "24"))

# Migration: dual-DB URLs for ETL (Prod read-only → v2 write-only)
SRC_DATABASE_URL = os.environ.get("SRC_DATABASE_URL")
DEST_DATABASE_URL = os.environ.get("DEST_DATABASE_URL")
