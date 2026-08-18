"""Fail-closed MongoDB settings for same-database cutover (NOT application default).

Use only after:
- EXACT MaintainPro MONGODB_DATABASE name confirmed
- Collection collision audit PASS
- Full application Mongo compatibility proven on isolated POC

Never commit MONGODB_URI credentials.
"""

from __future__ import annotations

import logging

from django.core.exceptions import ImproperlyConfigured

from config.mongo_contrib import MongoAdminConfig, MongoAuthConfig, MongoContentTypesConfig
from config.settings.base import *  # noqa: F403
from config.settings.base import (
    CACHE_KEY_PREFIX,
    INSTALLED_APPS as BASE_INSTALLED_APPS,
    env,
)
from config.settings.database import build_caches

logger = logging.getLogger(__name__)

DEBUG = False
ENVIRONMENT_LABEL = env.str("ENVIRONMENT_LABEL", default="mongo_same_db_staging")

_REQUIRED = ("MONGODB_URI", "MONGODB_DATABASE", "DJANGO_SECRET_KEY", "REDIS_URL")
_missing = [name for name in _REQUIRED if not env(name, default=None)]
if _missing:
    raise ImproperlyConfigured(
        "Mongo same-database settings require: " + ", ".join(_missing)
    )

MONGODB_URI = env("MONGODB_URI")
MONGODB_DATABASE = env("MONGODB_DATABASE")

# Documented company MaintainPro logical database (same-server target).
MONGODB_PRODUCTION_TARGET_DATABASE = env.str(
    "MONGODB_PRODUCTION_TARGET_DATABASE",
    default="maintainpro_prod",
)

if MONGODB_DATABASE != MONGODB_PRODUCTION_TARGET_DATABASE:
    raise ImproperlyConfigured(
        "mongo_same_db mode requires MONGODB_DATABASE to equal "
        f"MONGODB_PRODUCTION_TARGET_DATABASE ({MONGODB_PRODUCTION_TARGET_DATABASE!r}). "
        "Use mongo_same_db_poc / mongo_test for isolated compatibility testing."
    )

FG_COLLECTION_NAMESPACE_ENABLED = True
FG_COLLECTION_PREFIX = "fg_"

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": MONGODB_URI,
        "NAME": MONGODB_DATABASE,
    }
}

DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
DATABASE_ROUTERS = ["django_mongodb_backend.routers.MongoRouter"]

# Contrib AppConfigs so Permission/Group/LogEntry/ContentType use ObjectId (POC-proven).
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

REDIS_URL = env("REDIS_URL")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

HEALTHCHECK_MONGODB_ENABLED = True

# Production cutover does not use PostgreSQL.
POSTGRES_REQUIRED = False

logger.warning(
    "FG mongo_same_db mode: database=%s — MaintainPro collision audit required before use",
    MONGODB_DATABASE,
)
