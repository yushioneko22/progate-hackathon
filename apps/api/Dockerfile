# syntax=docker/dockerfile:1.7
ARG PYTHON_VERSION=3.12-slim

FROM python:${PYTHON_VERSION} AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1
COPY --from=ghcr.io/astral-sh/uv:0.5.13 /uv /usr/local/bin/uv
WORKDIR /app

# --- dependencies (cached layer) ---
FROM base AS deps
COPY apps/api/pyproject.toml apps/api/uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# --- runtime ---
FROM base AS runtime
COPY --from=deps /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"
COPY apps/api/app ./app
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/pyproject.toml ./pyproject.toml
EXPOSE 8787
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8787"]
