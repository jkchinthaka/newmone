"""Production settings — MongoDB is the authoritative FG runtime.

Set FG_DATABASE_BACKEND=postgresql only for legacy emergency rollback (not the
unified MaintainPro platform path).
"""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403
from config.settings.base import CACHE_KEY_PREFIX, LOGGING, env
from config.settings.database import build_caches, build_databases

DEBUG = False
ENVIRONMENT_LABEL = env.str("ENVIRONMENT_LABEL", default="production")

FG_DATABASE_BACKEND = env.str("FG_DATABASE_BACKEND", default="mongodb").strip().lower()

_COMMON_REQUIRED = (
    "DJANGO_SECRET_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "REDIS_URL",
)

if FG_DATABASE_BACKEND == "mongodb":
    _REQUIRED = _COMMON_REQUIRED + ("MONGODB_URI", "MONGODB_DATABASE")
elif FG_DATABASE_BACKEND == "postgresql":
    _REQUIRED = _COMMON_REQUIRED + (
        "POSTGRES_DB",
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
    )
else:
    raise ImproperlyConfigured(
        "FG_DATABASE_BACKEND must be 'mongodb' (default) or 'postgresql' (legacy)."
    )

_missing = [name for name in _REQUIRED if not env(name, default=None)]
if _missing:
    raise ImproperlyConfigured(
        "Production settings require the following environment variables: " + ", ".join(_missing)
    )

SECRET_KEY = env("DJANGO_SECRET_KEY")
if SECRET_KEY.startswith("local-only") or SECRET_KEY.startswith("test-only"):
    raise ImproperlyConfigured("Production SECRET_KEY must not use development placeholders.")

ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Production ALLOWED_HOSTS must be explicit and non-wildcard.")

CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS")
if not CSRF_TRUSTED_ORIGINS:
    raise ImproperlyConfigured("Production CSRF_TRUSTED_ORIGINS must be set.")

REDIS_URL = env("REDIS_URL")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# Unified MaintainPro + FG production logical database (fail-closed).
REQUIRED_PRODUCTION_MONGODB_DATABASE = "maintainpro_prod"

if FG_DATABASE_BACKEND == "mongodb":
    from config.mongo_contrib import MongoAdminConfig, MongoAuthConfig, MongoContentTypesConfig
    from config.settings.base import INSTALLED_APPS as BASE_INSTALLED_APPS

    MONGODB_URI = env("MONGODB_URI")
    MONGODB_DATABASE = env("MONGODB_DATABASE")
    MONGODB_PRODUCTION_TARGET_DATABASE = env.str(
        "MONGODB_PRODUCTION_TARGET_DATABASE",
        default=REQUIRED_PRODUCTION_MONGODB_DATABASE,
    )
    if MONGODB_DATABASE in {"admin", "config", "local"}:
        raise ImproperlyConfigured("Production Mongo database must not be a system database.")
    if MONGODB_PRODUCTION_TARGET_DATABASE != REQUIRED_PRODUCTION_MONGODB_DATABASE:
        raise ImproperlyConfigured(
            "MONGODB_PRODUCTION_TARGET_DATABASE must be "
            f"{REQUIRED_PRODUCTION_MONGODB_DATABASE!r} (got "
            f"{MONGODB_PRODUCTION_TARGET_DATABASE!r}). Arbitrary database names are not allowed."
        )
    if MONGODB_DATABASE != REQUIRED_PRODUCTION_MONGODB_DATABASE:
        raise ImproperlyConfigured(
            "Production Mongo MONGODB_DATABASE must be "
            f"{REQUIRED_PRODUCTION_MONGODB_DATABASE!r} (got {MONGODB_DATABASE!r})."
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
    HEALTHCHECK_MONGODB_ENABLED = True
    POSTGRES_REQUIRED = False
else:
    DATABASES = build_databases(env)
    POSTGRES_REQUIRED = True

# Secure-by-default TLS cookie/redirect policy. Temporary HTTP deployments must
# set ALLOW_INSECURE_HTTP=true explicitly (same convention as MaintainPro web).
ALLOW_INSECURE_HTTP = env.bool("ALLOW_INSECURE_HTTP", default=False)
if ALLOW_INSECURE_HTTP:
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False
    SECURE_SSL_REDIRECT = False
else:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)

SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

LOGGING["handlers"]["console"]["formatter"] = "json"  # type: ignore[index]
LOGGING["root"]["level"] = env.str("LOG_LEVEL", default="INFO")  # type: ignore[index]

SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=28800)
SESSION_SAVE_EVERY_REQUEST = True
