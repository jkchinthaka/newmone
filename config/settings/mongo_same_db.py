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

from config.settings.base import *  # noqa: F403
from config.settings.base import CACHE_KEY_PREFIX, env
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
    default="mgintginpro_prod",
)

if MONGODB_DATABASE != MONGODB_PRODUCTION_TARGET_DATABASE:
    raise ImproperlyConfigured(
        "mongo_same_db mode requires MONGODB_DATABASE to equal "
        f"MONGODB_PRODUCTION_TARGET_DATABASE ({MONGODB_PRODUCTION_TARGET_DATABASE!r}). "
        "Use mongo_same_db_poc for isolated compatibility testing."
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

REDIS_URL = env("REDIS_URL")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

logger.warning(
    "FG mongo_same_db mode: database=%s — MaintainPro collision audit required before use",
    MONGODB_DATABASE,
)
