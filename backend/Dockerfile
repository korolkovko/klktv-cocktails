FROM python:3.12-slim

# Install uv from official image
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

WORKDIR /app

# Install dependencies first for better layer caching
COPY pyproject.toml ./
RUN uv sync --no-dev

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
