"""Idempotent Mongo collection/index bootstrap with explicit production guards."""

from __future__ import annotations

import os

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.core.persistence.backend import is_mongodb


PRODUCTION_DATABASE = "maintainpro_prod"
SYSTEM_DATABASES = {"admin", "config", "local"}


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
        "Bootstrap FG Mongo collections/indexes via migrate. "
        "Production requires explicit database confirmation."
    )

    def add_arguments(self, parser) -> None:  # type: ignore[no-untyped-def]
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate all guards only; do not migrate.",
        )
        parser.add_argument(
            "--allow-production",
            action="store_true",
            help="Explicitly allow bootstrap against maintainpro_prod.",
        )
        parser.add_argument(
            "--confirm-database",
            default="",
            help="Exact database name confirmation required for production.",
        )

    def handle(self, *args, **options) -> None:  # type: ignore[no-untyped-def]
        db_name = str(
            getattr(settings, "MONGODB_DATABASE", "")
            or settings.DATABASES["default"].get("NAME", "")
        ).strip()

        settings_module = os.environ.get("DJANGO_SETTINGS_MODULE", "").strip()
        environment_label = str(
            getattr(settings, "ENVIRONMENT_LABEL", "")
        ).strip()

        production_target = str(
            getattr(settings, "MONGODB_PRODUCTION_TARGET_DATABASE", "")
        ).strip()

        if not is_mongodb():
            raise CommandError(
                "bootstrap_mongo_indexes requires a MongoDB database engine."
            )

        if not db_name:
            raise CommandError("Mongo database name is empty.")

        if db_name in SYSTEM_DATABASES:
            raise CommandError(
                f"Refusing bootstrap against system database {db_name!r}."
            )

        is_production_database = db_name == PRODUCTION_DATABASE

        if options["allow_production"] and not is_production_database:
            raise CommandError(
                "--allow-production may only be used with maintainpro_prod."
            )

        if is_production_database:
            if settings_module != "config.settings.production":
                raise CommandError(
                    "Production bootstrap requires "
                    "DJANGO_SETTINGS_MODULE=config.settings.production."
                )

            if environment_label != "production":
                raise CommandError(
                    "Production bootstrap requires ENVIRONMENT_LABEL=production."
                )

            if production_target != PRODUCTION_DATABASE:
                raise CommandError(
                    "Production target database must be maintainpro_prod."
                )

            if not options["allow_production"]:
                raise CommandError(
                    "Production bootstrap requires --allow-production."
                )

            if options["confirm_database"] != PRODUCTION_DATABASE:
                raise CommandError(
                    "Production bootstrap requires "
                    "--confirm-database maintainpro_prod."
                )

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    "dry-run ok: "
                    f"engine_mongo=True database={db_name} "
                    f"environment={environment_label} "
                    f"production={is_production_database}"
                )
            )
            return

        try:
            call_command(
                "migrate",
                interactive=False,
                verbosity=1,
            )

        except Exception as exc:  # noqa: BLE001
            # Production is fail-closed. Never hide an integrity problem.
            if is_production_database:
                raise CommandError(
                    "Production Mongo bootstrap migrate failed: "
                    f"{exc.__class__.__name__}"
                ) from exc

            # Preserve legacy non-production idempotency behavior.
            if not _is_duplicate_key_error(exc):
                raise CommandError(
                    "Mongo bootstrap migrate failed: "
                    f"{exc.__class__.__name__}"
                ) from exc

            self.stdout.write(
                self.style.WARNING(
                    "Non-production migrate reported a duplicate-key "
                    "integrity conflict; treating as already bootstrapped."
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Mongo bootstrap complete for database={db_name}"
            )
        )