"""Import Organization / Site / Department / Shift from evidence-backed CSV."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.organizations.hierarchy_import import (
    empty_template_csv,
    format_error_report,
    import_organization_hierarchy,
)


class Command(BaseCommand):
    help = (
        "Import Organization/Site/Department/Shift hierarchy from CSV. "
        "Default is dry-run. Does not invent company values. "
        "Requires evidence-backed input (ASM-004/005/006)."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--csv",
            dest="csv_path",
            help="Path to hierarchy CSV (required unless --write-template).",
        )
        parser.add_argument(
            "--actor",
            help="Active User UUID with appropriate manage_* permission.",
        )
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Write rows atomically after validation (default is dry-run).",
        )
        parser.add_argument(
            "--error-file",
            dest="error_file",
            help="Optional path to write CSV error report.",
        )
        parser.add_argument(
            "--write-template",
            dest="write_template",
            help="Write header-only CSV template to this path and exit.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        template_path = options.get("write_template")
        if template_path:
            path = Path(str(template_path))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(empty_template_csv(), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote header-only template: {path}"))
            self.stdout.write(
                "Reminder: do not invent Organization/Site/Department/Shift values. "
                "ASM-004/005/006 evidence required."
            )
            return

        csv_path = options.get("csv_path")
        actor_raw = options.get("actor")
        if not csv_path or not actor_raw:
            raise CommandError("--csv and --actor are required (unless --write-template).")

        try:
            actor_id = UUID(str(actor_raw))
        except (TypeError, ValueError) as exc:
            raise CommandError("--actor must be a valid UUID.") from exc

        actor = User.objects.filter(pk=actor_id).first()
        if actor is None:
            raise CommandError("Actor user not found.")
        if not actor.is_active:
            raise CommandError("Actor user must be active.")

        dry_run = not bool(options.get("commit"))
        try:
            preview = import_organization_hierarchy(
                actor=actor,
                source=str(csv_path),
                dry_run=dry_run,
            )
        except PermissionDenied as exc:
            raise CommandError(str(exc) or "Permission denied.") from exc
        except ValidationError as exc:
            messages = "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            raise CommandError(messages) from exc

        self.stdout.write(preview.message)
        self.stdout.write(f"dry_run={preview.dry_run}")
        self.stdout.write(f"ok={preview.ok}")
        self.stdout.write(f"row_count={preview.row_count}")
        self.stdout.write(f"duplicate_codes={preview.duplicate_codes}")
        if preview.errors:
            self.stderr.write(self.style.ERROR(f"errors={len(preview.errors)}"))
            for err in preview.errors[:20]:
                self.stderr.write(f"  row={err.row_number} field={err.field}: {err.message}")

        error_file = options.get("error_file")
        if error_file:
            Path(str(error_file)).write_text(format_error_report(preview), encoding="utf-8")
            self.stdout.write(f"error_file={error_file}")

        if not preview.ok:
            raise CommandError("Hierarchy import validation failed.")

        self.stdout.write(
            "Reminder: official Nelna org/shift values remain gated by ASM-004/005/006."
        )
