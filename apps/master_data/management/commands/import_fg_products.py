"""Import FG Products from evidence-backed CSV (no live ERP calls)."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import UUID

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.master_data.product_import import (
    empty_product_import_template_csv,
    format_product_import_error_report,
    import_fg_products,
)


class Command(BaseCommand):
    help = (
        "Import FG Products from CSV. Default is dry-run. "
        "Does not invent Nelna catalogue values. No live Bileeta/ERP calls."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--csv", dest="csv_path", help="Path to product CSV.")
        parser.add_argument("--actor", help="Active User UUID with manage_fgproduct.")
        parser.add_argument(
            "--commit",
            action="store_true",
            help="Write rows atomically after validation (default dry-run).",
        )
        parser.add_argument("--error-file", dest="error_file", help="Error report CSV path.")
        parser.add_argument(
            "--write-template",
            dest="write_template",
            help="Write header-only CSV template and exit.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        template_path = options.get("write_template")
        if template_path:
            path = Path(str(template_path))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(empty_product_import_template_csv(), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Wrote header-only template: {path}"))
            self.stdout.write("Reminder: MASTER-001 evidence required before real catalogue load.")
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
            preview = import_fg_products(actor=actor, source=str(csv_path), dry_run=dry_run)
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
        self.stdout.write(f"duplicate_erp_codes={preview.duplicate_erp_codes}")
        if preview.errors:
            self.stderr.write(self.style.ERROR(f"errors={len(preview.errors)}"))
            for err in preview.errors[:20]:
                self.stderr.write(f"  row={err.row_number} field={err.field}: {err.message}")

        error_file = options.get("error_file")
        if error_file:
            Path(str(error_file)).write_text(
                format_product_import_error_report(preview), encoding="utf-8"
            )
            self.stdout.write(f"error_file={error_file}")

        if not preview.ok:
            raise CommandError("FG Product import validation failed.")

        self.stdout.write("Reminder: official catalogue remains gated by MASTER-001 / APR-005.")
