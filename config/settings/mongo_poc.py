"""Isolated MongoDB POC settings — never the application default.

Requires a replica set for multi-document transactions.
Default URI targets compose.mongo-poc.yaml (host port 27027).

Environment:
  MONGODB_URI — connection URI (no secrets committed)
  MONGODB_DATABASE — database name (default nelna_fg_mongo_poc)
"""

from __future__ import annotations

from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env", overwrite=False)

SECRET_KEY = env(
    "DJANGO_SECRET_KEY",
    default="mongo-poc-only-insecure-key-not-for-production",
)
DEBUG = True
ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]
USE_TZ = True
TIME_ZONE = "Asia/Colombo"
LANGUAGE_CODE = "en"
# Intentionally no ROOT_URLCONF / admin / auth User model.
# django.contrib.auth.User uses AutoField (unsupported on Mongo).
# Admin compatibility is documented separately as PASS_WITH_REFACTOR.
ENVIRONMENT_LABEL = "mongo_poc"

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "apps.mongo_poc",
]

MIDDLEWARE: list[str] = []

TEMPLATES: list[dict[str, object]] = []

# Official Django MongoDB Backend — not Djongo / abandoned backends.
_MONGODB_URI = env(
    "MONGODB_URI",
    default=(
        "mongodb://127.0.0.1:27027/"
        "?replicaSet=nelnaPocRs&directConnection=true&retryWrites=true&w=majority"
    ),
)
_MONGODB_DATABASE = env("MONGODB_DATABASE", default="nelna_fg_mongo_poc")

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "HOST": _MONGODB_URI,
        "NAME": _MONGODB_DATABASE,
    }
}

AUTH_PASSWORD_VALIDATORS: list[dict[str, str]] = []
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "mongo-poc",
    }
}
