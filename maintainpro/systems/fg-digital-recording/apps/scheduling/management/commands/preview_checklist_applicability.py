"""Preview checklist applicability for an operational context (Phase 07C)."""

from __future__ import annotations

import datetime
import json
import uuid
from typing import Any

from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import User
from apps.scheduling.applicability import preview_checklist_applicability
from apps.scheduling.models import ApplicabilityMatchOutcome


class Command(BaseCommand):
    help = (
        "Preview which checklist template/version would apply for a given "
        "organization context. Never silently picks among conflicts."
    )

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--organization", required=True, help="Organization UUID")
        parser.add_argument(
            "--actor",
            required=True,
            help="User UUID with scheduling.view_checklistapplicability",
        )
        parser.add_argument("--product", default="", help="Optional FG Product UUID")
        parser.add_argument("--site", default="", help="Optional Site UUID")
        parser.add_argument("--department", default="", help="Optional Department UUID")
        parser.add_argument("--shift", default="", help="Optional Shift UUID")
        parser.add_argument("--process-reference", default="", help="Optional process label")
        parser.add_argument(
            "--as-of",
            default="",
            help="Optional ISO date (YYYY-MM-DD); default today",
        )
        parser.add_argument("--json", action="store_true", help="Emit JSON preview payload")

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            organization_id = uuid.UUID(str(options["organization"]))
            actor_id = uuid.UUID(str(options["actor"]))
        except (TypeError, ValueError) as exc:
            raise CommandError("organization and actor must be UUIDs.") from exc

        actor = User.objects.filter(pk=actor_id).first()
        if actor is None or not actor.is_active:
            raise CommandError("Actor user not found or inactive.")

        def _opt_uuid(raw: str) -> uuid.UUID | None:
            raw = (raw or "").strip()
            if not raw:
                return None
            try:
                return uuid.UUID(raw)
            except ValueError as exc:
                raise CommandError(f"Invalid UUID: {raw}") from exc

        as_of = None
        if (options.get("as_of") or "").strip():
            try:
                as_of = datetime.date.fromisoformat(str(options["as_of"]).strip())
            except ValueError as exc:
                raise CommandError("--as-of must be YYYY-MM-DD") from exc

        try:
            result = preview_checklist_applicability(
                actor=actor,
                organization_id=organization_id,
                product_id=_opt_uuid(options.get("product") or ""),
                site_id=_opt_uuid(options.get("site") or ""),
                department_id=_opt_uuid(options.get("department") or ""),
                shift_id=_opt_uuid(options.get("shift") or ""),
                process_reference=options.get("process_reference") or "",
                as_of=as_of,
            )
        except Exception as exc:  # noqa: BLE001
            raise CommandError(str(exc)) from exc

        if options.get("json"):
            self.stdout.write(json.dumps(result.to_preview_dict(), indent=2, sort_keys=True))
            return

        self.stdout.write(f"outcome={result.outcome}")
        self.stdout.write(f"message={result.message}")
        if result.as_of:
            self.stdout.write(f"as_of={result.as_of.isoformat()}")
        if result.outcome == ApplicabilityMatchOutcome.ONE_MATCH and result.matched_rule:
            rule = result.matched_rule
            self.stdout.write(f"rule_code={rule.code}")
            self.stdout.write(f"template_code={rule.checklist_template.code}")
            self.stdout.write(f"version_number={rule.checklist_version.version_number}")
            self.stdout.write(f"checklist_version_id={rule.checklist_version_id}")
        else:
            self.stdout.write(f"matched_rule_count={len(result.matched_rules)}")
            for rule in result.matched_rules:
                self.stdout.write(
                    f"candidate={rule.code} template={rule.checklist_template.code} "
                    f"version={rule.checklist_version.version_number}"
                )
            if result.invalid_rules:
                self.stdout.write(f"invalid_rule_count={len(result.invalid_rules)}")
