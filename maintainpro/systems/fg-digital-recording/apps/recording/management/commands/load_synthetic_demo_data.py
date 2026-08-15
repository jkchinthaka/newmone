"""Load synthetic DEMO / TEST data for local handover walkthroughs."""

from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.recording.synthetic_demo import DEMO_BANNER, DEMO_PASSWORD, load_synthetic_demo_data


class Command(BaseCommand):
    help = (
        "Load a synthetic DEMO / TEST dataset for local walkthroughs. "
        "This is not company master data and is blocked outside local/test."
    )

    def handle(self, *args: Any, **options: Any) -> None:
        self.stdout.write(self.style.WARNING(DEMO_BANNER))
        try:
            dataset = load_synthetic_demo_data()
        except ValidationError as exc:
            raise CommandError(str(exc)) from exc

        state = "created" if dataset.created else "already present"
        self.stdout.write(f"Synthetic demo dataset {state}.")
        self.stdout.write(f"Organization: {dataset.organization.code} ({dataset.organization.id})")
        self.stdout.write("Site / department / shift: DEMOSITE1 / DEMODEPT1 / DEMOSHIFT1")
        self.stdout.write(f"Product: {dataset.product.code}")
        self.stdout.write(f"Checklist: {dataset.template.code}")
        self.stdout.write(f"Task batch: {dataset.task.batch_reference}")
        self.stdout.write("Local-only demo users (not real employees):")
        self.stdout.write("  DEMO-ADMIN-001  (checklist/product/task manage)")
        self.stdout.write("  DEMO-REC-001    (recorder)")
        self.stdout.write("  DEMO-SUP-001    (supervisor review)")
        self.stdout.write("  DEMO-QA-001     (QA review)")
        self.stdout.write(f"Password for all demo users: {DEMO_PASSWORD}")
        self.stdout.write(self.style.WARNING(DEMO_BANNER))
