"""Isolated MongoDB test settings — NEVER maintainpro_prod / admin / config / local.

Usage:
  DJANGO_SETTINGS_MODULE=config.settings.mongo_test
  MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true
  MONGODB_DATABASE=maintainpro_fg_test

Fail-closed: refuses production and system database names.
"""

from __future__ import annotations

import logging
import os
import uuid

import environ
from django.core.exceptions import ImproperlyConfigured

from config.mongo_contrib import MongoAdminConfig, MongoAuthConfig, MongoContentTypesConfig
from config.settings.base import *  # noqa: F403
from config.settings.base import (
    BASE_DIR,
    CACHE_KEY_PREFIX,
    INSTALLED_APPS as BASE_INSTALLED_APPS,
    env,
)
from config.settings.database import build_caches

logger = logging.getLogger(__name__)

environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

DEBUG = True
SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="mongo-test-only-insecure-key-not-for-production",
)
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
CSRF_TRUSTED_ORIGINS = ["http://testserver", "http://localhost", "http://127.0.0.1"]
ENVIRONMENT_LABEL = "mongo_test"

_FORBIDDEN_DB_NAMES = frozenset(
    {
        "maintainpro_prod",
        "admin",
        "config",
        "local",
        "mgintginpro_prod",
    }
)

MONGODB_PRODUCTION_TARGET_DATABASE = env.str(
    "MONGODB_PRODUCTION_TARGET_DATABASE",
    default="maintainpro_prod",
)

_REQUIRED = ("MONGODB_URI",)
_missing = [name for name in _REQUIRED if not env(name, default=None)]
if _missing:
    raise ImproperlyConfigured("mongo_test requires: " + ", ".join(_missing))

MONGODB_URI = env("MONGODB_URI")
# Prefer explicit test DB; otherwise unique per process to avoid collisions.
_default_test_db = env.str("MONGODB_DATABASE", default="") or os.environ.get(
    "MONGODB_TEST_DATABASE", ""
)
if not _default_test_db:
    _default_test_db = f"maintainpro_fg_test_{uuid.uuid4().hex[:8]}"
MONGODB_DATABASE = _default_test_db.strip()

if MONGODB_DATABASE in _FORBIDDEN_DB_NAMES:
    raise ImproperlyConfigured(
        f"mongo_test refuses database name {MONGODB_DATABASE!r}. "
        "Use an isolated name such as maintainpro_fg_test."
    )
if MONGODB_DATABASE == MONGODB_PRODUCTION_TARGET_DATABASE:
    raise ImproperlyConfigured(
        "mongo_test refuses the production MaintainPro database name "
        f"({MONGODB_PRODUCTION_TARGET_DATABASE!r})."
    )
if MONGODB_DATABASE.startswith("admin") or MONGODB_DATABASE in {"config", "local"}:
    raise ImproperlyConfigured("mongo_test refuses Mongo system database names.")

FG_COLLECTION_NAMESPACE_ENABLED = True
FG_COLLECTION_PREFIX = "fg_"

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": MONGODB_URI,
        "NAME": MONGODB_DATABASE,
        # Reuse the isolated fail-closed DB; never invent a second prod-like name.
        "TEST": {
            "NAME": MONGODB_DATABASE,
        },
    }
}

DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
DATABASE_ROUTERS = ["django_mongodb_backend.routers.MongoRouter"]

_CONTRIB_REPLACEMENTS = {
    "django.contrib.admin": "config.mongo_contrib.MongoAdminConfig",
    "django.contrib.auth": "config.mongo_contrib.MongoAuthConfig",
    "django.contrib.contenttypes": "config.mongo_contrib.MongoContentTypesConfig",
}
INSTALLED_APPS = ["django_mongodb_backend"]
for _app in BASE_INSTALLED_APPS:
    INSTALLED_APPS.append(_CONTRIB_REPLACEMENTS.get(_app, _app))

MIGRATION_MODULES = {
    "admin": "mongo_migrations.admin",
    "auth": "mongo_migrations.auth",
    "contenttypes": "mongo_migrations.contenttypes",
}

_ = (MongoAdminConfig, MongoAuthConfig, MongoContentTypesConfig)

REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6380/0")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
# Prefer locmem for isolated unit/integration gates unless REDIS_REQUIRED=1.
if env.bool("REDIS_REQUIRED", default=False):
    CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "fg-mongo-test",
        }
    }
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

HEALTHCHECK_MONGODB_ENABLED = True
POSTGRES_REQUIRED = False

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SECURE_SSL_REDIRECT = False
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

logger.warning(
    "mongo_test: isolated DB=%s (forbidden production/system names blocked)",
    MONGODB_DATABASE,
)
