"""Isolated same-database MongoDB POC — NEVER writes to company production DB.

Simulates FG + MaintainPro coexisting in one logical database using:
- FG collections with ``fg_`` namespace (via FG_COLLECTION_NAMESPACE_ENABLED)
- A dedicated POC database name (NOT ``mgintginpro_prod``)

Company production target (documented only — not used for writes here):
  MONGODB_DATABASE=mgintginpro_prod
  Host/port supplied by operations (example: 127.0.0.1:27018)

Environment for this POC:
  DJANGO_SETTINGS_MODULE=config.settings.mongo_same_db_poc
  MONGODB_URI=mongodb://127.0.0.1:27027/?replicaSet=nelnaPocRs&directConnection=true&...
  MONGODB_DATABASE=fg_same_db_poc
  MONGODB_PRODUCTION_TARGET_DATABASE=mgintginpro_prod  (read-only label; no writes)

Never commit real credentials in MONGODB_URI.
"""

from __future__ import annotations

import logging

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403
from config.settings.base import CACHE_KEY_PREFIX, env
from config.settings.database import build_caches

logger = logging.getLogger(__name__)

DEBUG = True
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
ENVIRONMENT_LABEL = "mongo_same_db_poc"

# Documented company target — informational; POC uses a separate database name.
MONGODB_PRODUCTION_TARGET_DATABASE = env.str(
    "MONGODB_PRODUCTION_TARGET_DATABASE",
    default="mgintginpro_prod",
)

_REQUIRED = ("MONGODB_URI", "MONGODB_DATABASE")
_missing = [name for name in _REQUIRED if not env(name, default=None)]
if _missing:
    raise ImproperlyConfigured(
        "mongo_same_db_poc requires: " + ", ".join(_missing)
    )

MONGODB_URI = env("MONGODB_URI")
MONGODB_DATABASE = env("MONGODB_DATABASE")

if MONGODB_DATABASE == MONGODB_PRODUCTION_TARGET_DATABASE:
    raise ImproperlyConfigured(
        "mongo_same_db_poc refuses to use the production MaintainPro database name "
        f"({MONGODB_PRODUCTION_TARGET_DATABASE!r}). Use an isolated POC database such as "
        "'fg_same_db_poc'."
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

REDIS_URL = env("REDIS_URL", default="redis://127.0.0.1:6380/0")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

logger.warning(
    "mongo_same_db_poc: writing only to isolated DB=%s; production target=%s (no writes)",
    MONGODB_DATABASE,
    MONGODB_PRODUCTION_TARGET_DATABASE,
)
