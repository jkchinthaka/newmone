from django.apps import AppConfig


class MongoPocConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "apps.mongo_poc"
    label = "mongo_poc"
    verbose_name = "MongoDB POC (isolated)"
