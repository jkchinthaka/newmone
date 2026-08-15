"""Local development settings."""

from __future__ import annotations

import environ

from config.settings.base import *  # noqa: F403
from config.settings.base import BASE_DIR, CACHE_KEY_PREFIX, env
from config.settings.database import build_caches, build_databases

environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

DEBUG = env.bool("DJANGO_DEBUG", default=True)
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="local-only-insecure-development-key-not-for-production",
)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["127.0.0.1", "localhost", "web"])
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=["http://127.0.0.1:8000", "http://localhost:8000"],
)
ENVIRONMENT_LABEL = env.str("ENVIRONMENT_LABEL", default="local")

DATABASES = build_databases(env)
REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6380/0")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
