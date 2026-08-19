"""Mongo-only Django contrib AppConfig classes (ObjectIdAutoField).

Activated only from ``config.settings.mongo_same_db*`` — never on PostgreSQL main.
See: https://django-mongodb-backend.readthedocs.io/en/latest/intro/configure/
"""

from __future__ import annotations

from django.contrib.admin.apps import AdminConfig
from django.contrib.auth.apps import AuthConfig
from django.contrib.contenttypes.apps import ContentTypesConfig

_OBJECT_ID = "django_mongodb_backend.fields.ObjectIdAutoField"


class MongoAdminConfig(AdminConfig):
    default_auto_field = _OBJECT_ID


class MongoAuthConfig(AuthConfig):
    default_auto_field = _OBJECT_ID


class MongoContentTypesConfig(ContentTypesConfig):
    default_auto_field = _OBJECT_ID
