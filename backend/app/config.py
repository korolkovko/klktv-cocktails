import os

SECRET_KEY = os.environ.get("SECRET_KEY", "klktv-cocktails-dev-secret-change-in-prod")
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/klktv_cocktails")

CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

COOKIE_NAME = "klktv_session"
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none")  # "none" for cross-origin prod, "lax" for local
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN") or None

ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
