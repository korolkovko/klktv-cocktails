import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

load_dotenv()

from app.config import CORS_ORIGINS, DEBUG  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.routers import admin, auth, content, me, team, uploads  # noqa: E402

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="KLKTV Cocktails API",
    docs_url="/api/docs" if DEBUG else None,
    redoc_url=None if not DEBUG else "/api/redoc",
    openapi_url="/api/openapi.json" if DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(content.router)
app.include_router(me.router)
app.include_router(team.router)
app.include_router(uploads.router)

# Serve uploaded images at /static/img/<filename>
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/img", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health(response: Response):
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception:
        response.status_code = 503
        return {"status": "db_unreachable"}
