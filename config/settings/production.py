"""Production settings — fail closed when required configuration is missing."""

from __future__ import annotations

from django.core.exceptions import ImproperlyConfigured

from config.settings.base import *  # noqa: F403
from config.settings.base import CACHE_KEY_PREFIX, LOGGING, env
from config.settings.database import build_caches, build_databases

DEBUG = False
ENVIRONMENT_LABEL = env.str("ENVIRONMENT_LABEL", default="production")

_REQUIRED = (
    "DJANGO_SECRET_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "POSTGRES_HOST",
    "POSTGRES_PORT",
    "REDIS_URL",
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

DATABASES = build_databases(env)
REDIS_URL = env("REDIS_URL")
REDIS_CACHE_TIMEOUT = env.int("REDIS_CACHE_TIMEOUT", default=300)
CACHES = build_caches(env, REDIS_URL, CACHE_KEY_PREFIX, REDIS_CACHE_TIMEOUT)
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31536000)
# HSTS includeSubDomains: enabled by default for production HTTPS deployments.
# Disable only with an explicit documented exception if subdomains are not ready.
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
# HSTS preload: disabled by default — enable only after deliberate domain submission readiness.
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=False)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

LOGGING["handlers"]["console"]["formatter"] = "json"  # type: ignore[index]
LOGGING["root"]["level"] = env.str("LOG_LEVEL", default="INFO")  # type: ignore[index]

# Phase 19 — production session defaults (override via env; final IT policy EVIDENCE REQUIRED).
SESSION_COOKIE_AGE = env.int("SESSION_COOKIE_AGE", default=28800)
SESSION_SAVE_EVERY_REQUEST = True
