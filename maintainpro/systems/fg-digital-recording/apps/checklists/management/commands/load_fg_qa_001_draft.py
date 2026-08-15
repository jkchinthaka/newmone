"""Load FG-QA-001 as an Organization-scoped DRAFT proposal for review."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.checklists.proposal_loader import load_fg_qa_001_draft


class Command(BaseCommand):
    help = (
        "Instantiate FG-QA-001 proposal as a DRAFT checklist for one Organization. "
        "Never publishes. Never auto-seeds. Never assigns Products."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--organization",
            required=True,
            help="Organization UUID (required; no default/guess).",
        )
        parser.add_argument(
            "--actor",
            required=True,
            help="Active User UUID with manage_checklist for that Organization.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report actions without writing.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            organization_id = uuid.UUID(str(options["organization"]))
        except (TypeError, ValueError) as exc:
            raise CommandError("--organization must be a valid UUID.") from exc
        try:
            actor_id = uuid.UUID(str(options["actor"]))
        except (TypeError, ValueError) as exc:
            raise CommandError("--actor must be a valid UUID.") from exc

        actor = User.objects.filter(pk=actor_id).first()
        if actor is None:
            raise CommandError("Actor user not found.")
        if not actor.is_active:
            raise CommandError("Actor user must be active.")

        dry_run = bool(options["dry_run"])
        try:
            result = load_fg_qa_001_draft(
                actor=actor,
                organization_id=organization_id,
                dry_run=dry_run,
            )
        except PermissionDenied as exc:
            raise CommandError(str(exc) or "Permission denied.") from exc
        except ValidationError as exc:
            messages = "; ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
            raise CommandError(messages) from exc

        self.stdout.write(self.style.SUCCESS(result.message))
        self.stdout.write(f"status={result.status}")
        self.stdout.write(f"dry_run={result.dry_run}")
        self.stdout.write(f"template_id={result.template_id}")
        self.stdout.write(f"version_id={result.version_id}")
        self.stdout.write(f"section_count={result.section_count}")
        self.stdout.write(f"item_count={result.item_count}")
        for key, value in result.details.items():
            self.stdout.write(f"{key}={value}")
        self.stdout.write("Reminder: FG-QA-001 remains PROPOSED / NOT APPROVED FOR PRODUCTION USE.")
