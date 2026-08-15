"""Offline settings for release packaging (collectstatic / asset checks only).

Never use this module to run the application in production, staging, or UAT.
It exists so the packaging script can collect static files without requiring
production secrets or a live database/Redis connection.
"""

from __future__ import annotations

from config.settings.base import *  # noqa: F403
from config.settings.base import BASE_DIR

DEBUG = False
SECRET_KEY = "release-build-collectstatic-only-not-for-runtime-use"
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "testserver"]
CSRF_TRUSTED_ORIGINS: list[str] = []
ENVIRONMENT_LABEL = "release_build"

# In-memory SQLite — packaging only; production runtime remains PostgreSQL/Mongo.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / ".release_build_collectstatic.sqlite3",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "nelna-release-build",
    }
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
REDIS_URL = "redis://127.0.0.1:6380/15"
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
