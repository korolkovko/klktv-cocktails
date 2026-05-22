# Kollektiv — Cocktail Menu

Закрытая коктейльная карта бара Kollektiv. Доступ только по логину.

## Стек

- **Frontend:** React 18 + Vite + nginx
- **Backend:** FastAPI + SQLAlchemy 2.0 + Postgres + JWT в HttpOnly cookie
- **Package management:** `npm` (frontend), `uv` (backend)
- **Хостинг:** Railway (frontend + backend + Postgres — 3 сервиса)
- **Закрыт от индексирования:** `robots.txt` + `<meta name="robots" content="noindex,nofollow">`

## Структура

```
klktv-cocktails/
├─ frontend/        # React SPA (Dockerfile → nginx)
├─ backend/         # FastAPI app (Dockerfile → uvicorn via uv)
├─ docker-compose.yml  # local postgres
└─ README.md
```

## Локальный запуск

### 1. Postgres

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env
uv sync
uv run python seed.py            # создаст 12 юзеров
uv run uvicorn app.main:app --reload --port 8000
```

API на `http://localhost:8000`, Swagger UI на `http://localhost:8000/api/docs`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Открывается на `http://localhost:5173`.

## Пользователи

Создаются `seed.py`. Список — см. [backend/seed.py](backend/seed.py).

## Railway deploy

В каждом push в `main` Railway автоматически пересобирает оба сервиса (frontend и backend).

### Первоначальная настройка (один раз)

В Railway-проекте создать **три сервиса**:

1. **Postgres** — Add Service → Database → Postgres.
2. **Backend** — Add Service → GitHub Repo → этот репозиторий.
   - **Root Directory:** `backend`
   - **Environment Variables:**
     - `DATABASE_URL` — Reference → Postgres → `DATABASE_URL`
     - `SECRET_KEY` — длинная случайная строка (`python -c "import secrets; print(secrets.token_urlsafe(48))"`)
     - `CORS_ORIGINS` — URL фронта, напр. `https://kollektiv-menu.up.railway.app`
     - `COOKIE_SECURE` — `true`
     - `COOKIE_SAMESITE` — `none` (нужно для cross-origin cookies)
3. **Frontend** — Add Service → GitHub Repo → этот репозиторий.
   - **Root Directory:** `frontend`
   - **Build Args:**
     - `VITE_API_URL` — URL бэка, напр. `https://kollektiv-api.up.railway.app`
   - **Networking:** Generate Domain

После каждого push в `main` оба сервиса автоматически пересобираются.

`seed.py` запускается на каждом старте бэкенда (упомянут в `startCommand` в `backend/railway.json`) — это безопасно, потому что он idempotent (обновляет пароли существующих юзеров, создаёт отсутствующих).
