from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.config import CORS_ORIGINS  # noqa: E402
from app.database import init_db  # noqa: E402
from app.routers import admin, auth, content, me  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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


@app.get("/health")
def health():
    return {"status": "ok"}
