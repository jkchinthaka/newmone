"""Test settings — PostgreSQL and Redis required; no SQLite."""

from __future__ import annotations

import environ

from config.settings.base import *  # noqa: F403
from config.settings.base import BASE_DIR, CACHE_KEY_PREFIX, env
from config.settings.database import build_caches, build_databases

environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

DEBUG = False
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="test-only-insecure-key-not-for-production-use",
)
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
CSRF_TRUSTED_ORIGINS = ["http://testserver"]
ENVIRONMENT_LABEL = "test"

DATABASES = build_databases(env)
DATABASES["default"]["TEST"] = {
    "NAME": env("POSTGRES_TEST_DB", default="test_nelna_fg"),
}
REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6380/0")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
