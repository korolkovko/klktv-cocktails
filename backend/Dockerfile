FROM python:3.12-slim

WORKDIR /app

# Install uv from official image
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

# Install Python dependencies into the system interpreter (no venv) for the
# same flat layout as the existing klktv-kb deploy. This avoids any PATH /
# venv-activation issues at runtime.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache \
    "fastapi>=0.115.5" \
    "uvicorn[standard]>=0.32.1" \
    "sqlalchemy>=2.0.36" \
    "psycopg2-binary>=2.9.10" \
    "python-jose[cryptography]>=3.3.0" \
    "bcrypt>=4.2.1" \
    "python-dotenv>=1.0.1" \
    "pydantic>=2.10.0" \
    "python-multipart>=0.0.12"

COPY . .

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "python seed.py && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
