"""Database settings builder shared across environments."""

from __future__ import annotations

from typing import Any

import environ


def build_databases(env: environ.Env) -> dict[str, dict[str, Any]]:
    return {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("POSTGRES_DB", default="nelna_fg"),
            "USER": env("POSTGRES_USER", default="nelna_fg"),
            "PASSWORD": env("POSTGRES_PASSWORD", default=""),
            "HOST": env("POSTGRES_HOST", default="127.0.0.1"),
            "PORT": env.int("POSTGRES_PORT", default=5432),
            "CONN_MAX_AGE": env.int("DB_CONN_MAX_AGE", default=60),
            "CONN_HEALTH_CHECKS": env.bool("DB_CONN_HEALTH_CHECKS", default=True),
            "OPTIONS": {
                "connect_timeout": env.int("DB_CONNECT_TIMEOUT", default=10),
            },
        }
    }


def build_caches(
    env: environ.Env, redis_url: str, key_prefix: str, timeout: int
) -> dict[str, dict[str, Any]]:
    return {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": redis_url,
            "KEY_PREFIX": key_prefix,
            "TIMEOUT": timeout,
        }
    }
