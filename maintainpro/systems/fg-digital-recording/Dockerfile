# Multi-stage production-oriented image for Nelna FG foundation.
# Does not run migrations automatically. Does not create superusers.
# Testing dependencies live only in the dedicated `test` stage — never in `runtime`.

############################
# Stage 1: frontend build
############################
FROM node:24.18.0-bookworm-slim AS frontend-build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY design/tokens ./design/tokens
COPY scripts/build_design_tokens.py scripts/copy_frontend_vendor_assets.js ./scripts/
COPY static/src ./static/src
COPY design/generated ./design/generated
COPY static/src/css/generated-tokens.css ./static/src/css/generated-tokens.css
RUN npm run copy:vendor && npm run build:css

############################
# Stage 2: Python deps (runtime only)
############################
FROM python:3.13.14-slim-bookworm AS python-deps
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /usr/local/bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_HTTP_TIMEOUT=300
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock README.md ./
COPY apps ./apps
COPY config ./config
COPY manage.py ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-group development --no-group testing --no-group security --group mongo

############################
# Stage 3: Python deps (test + quality tools)
############################
FROM python:3.13.14-slim-bookworm AS python-deps-test
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /usr/local/bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0 \
    UV_HTTP_TIMEOUT=300
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml uv.lock README.md ./
COPY apps ./apps
COPY config ./config
COPY manage.py ./
# Include development, testing, and security groups for validation tooling.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --all-groups

############################
# Stage 4: production runtime (no pytest / no test tooling)
############################
FROM python:3.13.14-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 nelna \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin nelna

COPY --from=python-deps /app/.venv /app/.venv
COPY --chown=nelna:nelna apps ./apps
COPY --chown=nelna:nelna config ./config
COPY --chown=nelna:nelna manage.py pyproject.toml uv.lock ./
COPY --chown=nelna:nelna templates ./templates
COPY --chown=nelna:nelna scripts ./scripts
COPY --chown=nelna:nelna tests ./tests
COPY --chown=nelna:nelna docs ./docs
COPY --chown=nelna:nelna infra/docker/entrypoint.sh /entrypoint.sh
COPY --from=frontend-build --chown=nelna:nelna /build/static/dist ./static/dist

RUN chmod +x /entrypoint.sh scripts/*.py \
    && mkdir -p staticfiles media \
    && chown -R nelna:nelna /app

USER nelna
EXPOSE 8000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health/live/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "2"]

############################
# Stage 5: dedicated test / validation image
############################
FROM python:3.13.14-slim-bookworm AS test
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.test \
    PATH="/app/.venv/bin:$PATH"
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 nelna \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin nelna

COPY --from=python-deps-test /app/.venv /app/.venv
COPY --chown=nelna:nelna apps ./apps
COPY --chown=nelna:nelna config ./config
COPY --chown=nelna:nelna manage.py pyproject.toml uv.lock ./
COPY --chown=nelna:nelna templates ./templates
COPY --chown=nelna:nelna scripts ./scripts
COPY --chown=nelna:nelna tests ./tests
COPY --chown=nelna:nelna docs ./docs
COPY --chown=nelna:nelna design ./design
COPY --chown=nelna:nelna package.json package-lock.json ./
COPY --chown=nelna:nelna infra/docker/entrypoint.sh /entrypoint.sh
COPY --from=frontend-build --chown=nelna:nelna /build/static/dist ./static/dist
COPY --chown=nelna:nelna static/src ./static/src

RUN chmod +x /entrypoint.sh scripts/*.py \
    && mkdir -p staticfiles media \
    && chown -R nelna:nelna /app

USER nelna
# No automatic migrations, fixtures, or superuser creation.
ENTRYPOINT ["/entrypoint.sh"]
CMD ["pytest"]
