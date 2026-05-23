import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv()

from app.config import CORS_ORIGINS  # noqa: E402
from app.database import init_db  # noqa: E402
from app.routers import admin, admin_users, auth, content, me, uploads  # noqa: E402

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/app/uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="KLKTV Cocktails API", docs_url="/api/docs", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(me.router)
app.include_router(admin.router)
app.include_router(admin_users.router)
app.include_router(uploads.router)

# Serve uploaded images at /static/img/<filename>
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/img", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
