"""Idempotent Mongo index/collection bootstrap — never drops data."""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

from apps.core.persistence.backend import is_mongodb


def _is_duplicate_key_error(err: BaseException) -> bool:
    cur: BaseException | None = err
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        name = type(cur).__name__.lower()
        text = str(cur).lower()
        if "integrity" in name or "e11000" in text or "duplicate" in text:
            return True
        cur = cur.__cause__ or cur.__context__
    return False


class Command(BaseCommand):
    help = (
        "Bootstrap FG Mongo collections/indexes via migrate (idempotent). "
        "Never drops databases or MaintainPro collections."
    )

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate settings only; do not migrate.",
        )

    def handle(self, *args, **options) -> None:  # type: ignore[no-untyped-def]
        db_name = str(
            getattr(settings, "MONGODB_DATABASE", "")
            or settings.DATABASES["default"].get("NAME", "")
        )
        forbidden = {"maintainpro_prod", "admin", "config", "local"}
        settings_module = getattr(settings, "ENVIRONMENT_LABEL", "")
        if db_name in forbidden:
            raise CommandError(f"Refusing bootstrap against forbidden database {db_name!r}.")
        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"dry-run ok: engine_mongo={is_mongodb()} database={db_name} env={settings_module}"
                )
            )
            return
        if not is_mongodb():
            raise CommandError("bootstrap_mongo_indexes requires a MongoDB database engine.")
        try:
            call_command("migrate", interactive=False, verbosity=1)
        except Exception as exc:  # noqa: BLE001 — migrate may race on contrib permissions
            if not _is_duplicate_key_error(exc):
                raise CommandError(
                    f"Mongo bootstrap migrate failed: {exc.__class__.__name__}"
                ) from exc
            self.stdout.write(
                self.style.WARNING(
                    "migrate reported a duplicate-key integrity conflict "
                    "(likely contrib permissions); treating as already bootstrapped"
                )
            )
        self.stdout.write(self.style.SUCCESS(f"Mongo bootstrap complete for database={db_name}"))
